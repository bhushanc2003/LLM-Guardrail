import re
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass

@dataclass
class PIIMatch:
    entity_type: str        # e.g., "AADHAAR", "PAN", "UPI_ID", "NAME", "EMAIL"
    category_id: int        # 1 to 15 based on standard DB categories
    category_name: str      # Human readable category name
    start: int
    end: int
    text: str
    confidence: float
    framework: str = "SHARED" # "HIPAA", "DPDP", or "SHARED"

class PIIDetector:
    """
    Multi-Compliance Zero-Trust PII & PHI Detector supporting both:
    1. HIPAA Safe Harbor (US Healthcare & 18 PHI Categories)
    2. DPDP Act 2023 (Digital Personal Data Protection Act - India 27 Categories)
    """

    CATEGORIES = {
        1: "Names",
        2: "Geographical Data",
        3: "Dates (Individual)",
        4: "Telephone Numbers",
        5: "Fax Numbers",
        6: "Email Addresses",
        7: "Social Security Numbers (SSN)",
        8: "Medical Record Numbers (MRN)",
        9: "Health Plan Beneficiary Numbers",
        10: "Account Numbers",
        11: "Certificate/License Numbers",
        12: "Vehicle Identifiers",
        13: "Device Identifiers",
        14: "Web URLs",
        15: "IP Addresses"
    }

    def __init__(self):
        self._compile_regexes()
        self._init_gliner()
        self._init_presidio()

    def _init_gliner(self):
        """Zero-shot contextual decision layer using GLiNER (the premier open-source alternative to Jev)."""
        self.gliner_model = None
        import os
        if os.getenv("ENABLE_GLINER", "true").lower() == "true":
            try:
                from gliner import GLiNER
                self.gliner_model = GLiNER.from_pretrained("urchade/gliner_small-v2.1")
                print("GLiNER Contextual Decision Engine initialized successfully.")
            except Exception as e:
                print(f"GLiNER init skipped / fallback enabled: {e}")
                self.gliner_model = None

    def _init_presidio(self):
        """NER pass (names / places) using Presidio on spaCy's small English model. Off unless ENABLE_PRESIDIO=true."""
        self.presidio_analyzer = None
        import os
        if os.getenv("ENABLE_PRESIDIO", "false").lower() == "true":
            try:
                from presidio_analyzer import AnalyzerEngine
                from presidio_analyzer.nlp_engine import NlpEngineProvider
                nlp = NlpEngineProvider(nlp_configuration={
                    "nlp_engine_name": "spacy",
                    "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
                }).create_engine()
                # Only the NER component is needed; dropping the parser/lemmatizer/tagger makes it ~2x faster.
                for pipe in ("parser", "lemmatizer", "attribute_ruler", "senter", "tagger"):
                    if pipe in nlp.nlp["en"].pipe_names:
                        nlp.nlp["en"].disable_pipe(pipe)
                self.presidio_analyzer = AnalyzerEngine(nlp_engine=nlp, supported_languages=["en"])
            except Exception as e:
                print(f"Presidio disabled: {e}")
                self.presidio_analyzer = None

    def _compile_regexes(self):
        """Compile regex patterns for Shared, HIPAA, and Indian DPDP compliance frameworks."""

        # ----------------------------------------------------
        # SHARED PATTERNS (Evaluated by both HIPAA and DPDP)
        # ----------------------------------------------------
        self.regex_email = re.compile(
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'
        )
        self.regex_ipv4 = re.compile(
            r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b'
        )
        self.regex_ipv6 = re.compile(
            r'\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|'
            r'\b(?:[0-9a-fA-F]{1,4}:){1,7}:|'
            r'::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b'
        )
        self.regex_url = re.compile(
            r'\bhttps?://[^\s<>"{}|\\^`]+[^\s<>"{}|\\^`.,;:!?]|'
            r'\bwww\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s<>"{}|\\^`]*'
        )
        self.regex_phone = re.compile(
            r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|'
            r'\b\d{3}[-.\s]\d{4}\b|'
            r'(?:Phone|Tel|Mobile|Cell)[:#\s]+(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b',
            re.IGNORECASE
        )
        self.regex_credit_card = re.compile(
            r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b|'
            r'\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b'
        )
        self.regex_bank_account = re.compile(
            r'(?:Account #|Acct #|Bank Account|IBAN)[:#\s]+[A-Za-z0-9-]{8,22}\b',
            re.IGNORECASE
        )
        self.regex_mac = re.compile(
            r'\b(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})\b'
        )
        self.regex_uuid = re.compile(
            r'\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b'
        )
        self.regex_device_sn = re.compile(
            r'(?:Serial Number|Serial #|IMEI|Device ID|Advertising ID)[:#\s]+[A-Za-z0-9-]{8,20}\b',
            re.IGNORECASE
        )
        self.regex_address = re.compile(
            r'(?:Address|Location|Residential Address)[:#\s]+[A-Za-z0-9\s.,#-]+?(?=\s*,|\s*Zip|\s*PIN|\s*\n|$)|'
            r'\b\d{1,5}\s+[A-Za-z0-9\s.,#-]+?\s+(?:Street|St|Terrace|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Way)\b',
            re.IGNORECASE
        )
        self.regex_city_county = re.compile(
            r'(?:City|County|Town|Locality|District)[:#\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'
        )
        self.regex_individual_date = re.compile(
            r'(?:DOB|Birth|Born|Date of Birth)[:#\s]+'
            r'(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})\b|'
            r'\b(?:0[1-9]|1[0-2])[/-](?:0[1-9]|[12][0-9]|3[01])[/-](?:19|20)\d{2}\b|'
            r'\b(?:19|20)\d{2}[/-](?:0[1-9]|1[0-2])[/-](?:0[1-9]|[12][0-9]|3[01])\b',
            re.IGNORECASE
        )
        self.regex_name_context = re.compile(
            r'(?i:Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.|Patient|Employee|Doctor|User|Person)[:#\s]+'
            r'([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)'
        )

        # ----------------------------------------------------
        # HIPAA SPECIFIC PATTERNS
        # ----------------------------------------------------
        self.regex_ssn = re.compile(
            r'\b\d{3}-\d{2}-\d{4}\b|'
            r'(?:SSN|Social Security|Soc Sec)[:#\s]+\d{3}[-\s]?\d{2}[-\s]?\d{4}\b',
            re.IGNORECASE
        )
        self.regex_fax = re.compile(
            r'(?:Fax|FAX|fax)[:#\s]+(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'
        )
        self.regex_mrn = re.compile(
            r'(?:MRN|Medical Record Number|Med Rec #|Record #)[:#\s]+[A-Za-z0-9-]{6,12}\b|'
            r'\bMRN-\d{6,10}\b',
            re.IGNORECASE
        )
        self.regex_patient_id = re.compile(
            r'\b(?i:patient\s+id|patient\s+#)[:#\s]+[A-Za-z0-9-]{5,12}\b'
        )
        self.regex_health_plan = re.compile(
            r'(?:Health Plan|Beneficiary ID|Policy #|Member ID|Insurance ID|HICN|Medicare ID)[:#\s]+[A-Za-z0-9-]{7,15}\b',
            re.IGNORECASE
        )
        self.regex_license = re.compile(
            r'(?:Driver\'?s License|DL #|License #|Cert #|Certificate #)[:#\s]+[A-Za-z0-9-]{6,16}\b',
            re.IGNORECASE
        )
        self.regex_vin = re.compile(
            r'(?:VIN|Vehicle ID)[:#\s]+[A-HJ-NPR-Z0-9]{17}\b|'
            r'\b[A-HJ-NPR-Z0-9]{17}\b',
            re.IGNORECASE
        )
        self.regex_license_plate = re.compile(
            r'(?:License Plate|Plate #|Tag #)[:#\s]+[A-Z0-9-]{3,8}\b',
            re.IGNORECASE
        )
        self.regex_zip = re.compile(
            r'(?:ZIP|Zip Code|Postal Code)[:#\s]+\d{5}(?:-\d{4})?\b|'
            r'\b\d{5}(?:-\d{4})?\b',
            re.IGNORECASE
        )
        self.regex_medical_date = re.compile(
            r'(?:Admitted|Admission|Discharged|Discharge|Died|Death|Surgery Date|Appointment Date|Date of Admission)[:#\s]+'
            r'(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})\b',
            re.IGNORECASE
        )

        # ----------------------------------------------------
        # DPDP SPECIFIC PATTERNS (India Personal Data Identifiers)
        # ----------------------------------------------------
        # 1. Aadhaar (12 digits, format: 4 4 4 or with keyword)
        self.regex_aadhaar = re.compile(
            r'\b[2-9]\d{3}\s\d{4}\s\d{4}\b|'
            r'(?:Aadhaar|UIDAI|Aadhar|Aadhaar No)[:#\s]+[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b',
            re.IGNORECASE
        )
        # 2. PAN Card (5 letters, 4 digits, 1 letter)
        self.regex_pan = re.compile(
            r'\b[A-Z]{5}[0-9]{4}[A-Z]\b|'
            r'(?:PAN|PAN Card|PAN No)[:#\s]+[A-Z]{5}[0-9]{4}[A-Z]\b',
            re.IGNORECASE
        )
        # 3. UPI ID (username@provider handles)
        self.regex_upi = re.compile(
            r'\b[a-zA-Z0-9.\-_]{2,64}@(okaxis|okhdfcbank|oksbi|okicici|paytm|ybl|ibl|upi|axl|apl|barodampay|federal|kotak|postbank|idfcbank|gpay|phonepe)\b|'
            r'(?:UPI|VPA|UPI ID)[:#\s]+[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9.\-_]{2,32}\b',
            re.IGNORECASE
        )
        # 4. Indian Mobile Number (+91 [6-9]XXXXXXXXX)
        self.regex_indian_mobile = re.compile(
            r'\b(?:\+91[\s-]?)?[6-9]\d{9}\b'
        )
        # 5. Indian PIN Code (6 digits with PIN keyword)
        self.regex_pin_code = re.compile(
            r'(?:PIN|PIN Code|Pin|Postal Code)[:#\s]+[1-9][0-9]{5}\b',
            re.IGNORECASE
        )
        # 6. Indian Passport (1 letter + 7 digits)
        self.regex_indian_passport = re.compile(
            r'(?:Passport|Passport No|Indian Passport)[:#\s]+[A-Z][0-9]{7}\b',
            re.IGNORECASE
        )
        # 7. Indian Voter ID (EPIC: 3 letters + 7 digits)
        self.regex_voter_id = re.compile(
            r'(?:Voter ID|EPIC|Voter ID No)[:#\s]+[A-Z]{3}[0-9]{7}\b|'
            r'\b[A-Z]{3}[0-9]{7}\b',
            re.IGNORECASE
        )
        # 8. Indian Driving Licence
        self.regex_indian_dl = re.compile(
            r'(?:Driving License|DL No|Driving Licence)[:#\s]+[A-Z]{2}[0-9]{2}[-\s]?[0-9]{11}\b|'
            r'\b[A-Z]{2}[0-9]{2}[-\s]?[0-9]{11}\b',
            re.IGNORECASE
        )
        # 9. Employee ID & Workplace Information
        self.regex_emp_id = re.compile(
            r'(?:Employee ID|Emp ID|Staff ID|Worker ID)[:#\s]+[A-Za-z0-9-]{4,16}\b',
            re.IGNORECASE
        )
        # 10. Salary & Financial History
        self.regex_salary = re.compile(
            r'(?:Salary|Income|CTC|Annual Package|Package|Stipend)[:#\s]+(?:₹|Rs\.?|INR\s*)?[\d.,]+(?:\s*(?:LPA|per annum|p\.a\.|per month|pm|lakhs?|crores?|k))?\b',
            re.IGNORECASE
        )
        # 11. Student ID & Academic Info
        self.regex_student_id = re.compile(
            r'(?:Student ID|Roll No|Enrollment No|Registration No)[:#\s]+[A-Za-z0-9-]{4,16}\b',
            re.IGNORECASE
        )
        # 12. Age & Gender when linked to an individual
        self.regex_age_gender = re.compile(
            r'(?:Age|Aged)[:#\s]+\d{1,3}\b|'
            r'\b(?:Male|Female|Non-binary),?\s*(?:aged?\s*\d{1,3}|\d{1,3}\s*years?\s*old)\b',
            re.IGNORECASE
        )
        # 13. GPS Coordinates & Geolocation
        self.regex_gps = re.compile(
            r'(?:GPS|Coordinates|Geolocation)[:#\s]+[-+]?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?),\s*[-+]?(?:180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})(?:\.\d+)?)\b',
            re.IGNORECASE
        )
        # 14. IFSC Code
        self.regex_ifsc = re.compile(
            r'\b[A-Z]{4}0[A-Z0-9]{6}\b'
        )

        # --- additions for the GuardRailBench typed values (generic forms, DPDP) ---
        # any handle@provider without a dot after it (UPI ids like typed.user@examplepay); emails need a dotted domain
        self.regex_upi_generic = re.compile(r'\b[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}\b(?!\.)')
        self.regex_passport_bare = re.compile(r'\bpassport\s+[A-Z][0-9]{7}\b|\b[A-Z][0-9]{7}\b', re.IGNORECASE)
        self.regex_bank_digits = re.compile(r'(?:Account|A/C|Acct)[^\d\n]{0,20}\d{9,18}\b|\b\d{12}\b', re.IGNORECASE)
        self.regex_indian_mobile_spaced = re.compile(r'(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]\d{5}\b')
        self.regex_emp_bare = re.compile(r'\bEMP-?\d{3,8}\b', re.IGNORECASE)

        # Bare capitalised name runs, e.g. "Jane Smith" inside raw record text (no "Patient"/"Dr." cue).
        self.regex_name_run = re.compile(r'\b[A-Z][a-z]+(?:\s+(?:[A-Z]\.|[A-Z][a-z]+)){1,3}\b')
        self.NAME_STOP = {w.lower() for w in '''
            The A An This That These Those There Here What Which Who When Where Why How Please Find Search Send Email Mail
            Look Get Show Tell Give Check Read Update Delete Schedule Submit Book Cancel Ask Answer Note Is Are Was Were
            Do Does Did Can Could Should Would Will Stage Type Medical Record Records Patient Patients Doctor Clinic
            Hospital Insurance Appointment Appointments Health Care Policy Privacy Notice Billing Claim Claims Lab Results
            Guide Refill Process Visiting Hours Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February
            March April May June July August September October November December Mg Daily Twice Disorder Cancer Breast
            Infection Diabetes Hypertension Carcinoma Ductal Invasive Bipolar Asymptomatic Dear Hello Hi Thanks Thank
            Regards Reminder Subject From To Cc Re Fwd In On At For Of And Or If It Its Our Your My We You They He She
            Tamoxifen Ondansetron Metoprolol Lithium Quetiapine Lorazepam Biktarvy IGNORE Name Phone Number Address
        '''.split()}

    def detect(self, text: str, check_hipaa: bool = True, check_dpdp: bool = True, aggressive_names: bool = False, use_gliner: bool = False) -> List[PIIMatch]:
        """
        Detect PII entities in text based on active compliance frameworks (HIPAA / DPDP).
        If both are False, returns empty list (pass-through).
        """
        if not check_hipaa and not check_dpdp:
            return []

        matches: List[PIIMatch] = []

        def _add(regex_obj, entity_type: str, category_id: int, confidence: float = 0.95, framework: str = "SHARED"):
            for m in regex_obj.finditer(text):
                matches.append(PIIMatch(
                    entity_type=entity_type,
                    category_id=category_id,
                    category_name=self.CATEGORIES[category_id],
                    start=m.start(),
                    end=m.end(),
                    text=m.group(0),
                    confidence=confidence,
                    framework=framework
                ))

        # ----------------------------------------------------
        # 1. EVALUATE SHARED PATTERNS (Active if either is ON)
        # ----------------------------------------------------
        _add(self.regex_email, "EMAIL", 6, 0.99, "SHARED")
        _add(self.regex_url, "URL", 14, 0.98, "SHARED")
        _add(self.regex_ipv4, "IP_ADDRESS", 15, 0.99, "SHARED")
        _add(self.regex_ipv6, "IP_ADDRESS", 15, 0.99, "SHARED")
        _add(self.regex_credit_card, "ACCOUNT_NUMBER", 10, 0.98, "SHARED")
        _add(self.regex_bank_account, "ACCOUNT_NUMBER", 10, 0.95, "SHARED")
        _add(self.regex_mac, "DEVICE_ID", 13, 0.98, "SHARED")
        _add(self.regex_uuid, "DEVICE_ID", 13, 0.98, "SHARED")
        _add(self.regex_phone, "PHONE", 4, 0.90, "SHARED")

        # ----------------------------------------------------
        # 2. EVALUATE DETERMINISTIC HIPAA PATTERNS
        # ----------------------------------------------------
        if check_hipaa:
            _add(self.regex_ssn, "SSN", 7, 0.98, "HIPAA")
            _add(self.regex_fax, "FAX", 5, 0.95, "HIPAA")
            _add(self.regex_mrn, "MRN", 8, 0.96, "HIPAA")
            _add(self.regex_patient_id, "PATIENT_ID", 8, 0.90, "HIPAA")
            _add(self.regex_health_plan, "HEALTH_BENEFICIARY_ID", 9, 0.95, "HIPAA")
            _add(self.regex_license, "LICENSE_NUMBER", 11, 0.94, "HIPAA")
            _add(self.regex_vin, "VEHICLE_ID", 12, 0.95, "HIPAA")
            _add(self.regex_license_plate, "VEHICLE_ID", 12, 0.92, "HIPAA")
            _add(self.regex_zip, "GEO_DATA", 2, 0.95, "HIPAA")

        # ----------------------------------------------------
        # 3. EVALUATE DETERMINISTIC DPDP PATTERNS (India Act 2023)
        # ----------------------------------------------------
        if check_dpdp:
            _add(self.regex_aadhaar, "AADHAAR", 7, 0.99, "DPDP")
            _add(self.regex_pan, "PAN", 11, 0.99, "DPDP")
            _add(self.regex_upi, "UPI_ID", 10, 0.98, "DPDP")
            _add(self.regex_indian_mobile, "INDIAN_MOBILE", 4, 0.95, "DPDP")
            _add(self.regex_pin_code, "PIN_CODE", 2, 0.95, "DPDP")
            _add(self.regex_voter_id, "VOTER_ID", 11, 0.95, "DPDP")
            _add(self.regex_indian_passport, "PASSPORT", 11, 0.95, "DPDP")
            _add(self.regex_indian_dl, "DRIVING_LICENSE", 11, 0.94, "DPDP")
            _add(self.regex_emp_id, "EMPLOYEE_ID", 11, 0.93, "DPDP")
            _add(self.regex_ifsc, "ACCOUNT_NUMBER", 10, 0.92, "DPDP")
            _add(self.regex_upi_generic, "UPI_ID", 10, 0.92, "DPDP")
            _add(self.regex_passport_bare, "PASSPORT", 11, 0.93, "DPDP")
            _add(self.regex_bank_digits, "ACCOUNT_NUMBER", 10, 0.96, "DPDP")
            _add(self.regex_emp_bare, "EMPLOYEE_ID", 11, 0.94, "DPDP")
            _add(self.regex_indian_mobile_spaced, "INDIAN_MOBILE", 4, 0.95, "DPDP")

        # ----------------------------------------------------
        # TIER 1: CONTEXTUAL DECISION MODEL (GLiNER - Zero-Shot Neural Decision Layer)
        # Evaluates non-deterministic entities (Names, Addresses, Clinical Dates, Salaries)
        # ----------------------------------------------------
        gliner_handled = False
        if use_gliner and self.gliner_model:
            try:
                gliner_labels = [
                    "person", "patient", "doctor",
                    "street address", "city", "location",
                    "admission date", "discharge date", "date of birth",
                    "salary", "student roll number"
                ]
                gliner_ents = self.gliner_model.predict_entities(text, gliner_labels, threshold=0.45)
                for ent in gliner_ents:
                    lbl = ent["label"]
                    start, end = ent["start"], ent["end"]
                    ent_text = ent["text"]
                    score = float(ent["score"])

                    if lbl in ["person", "patient", "doctor"]:
                        matches.append(PIIMatch(
                            entity_type="NAME",
                            category_id=1,
                            category_name=self.CATEGORIES[1],
                            start=start,
                            end=end,
                            text=ent_text,
                            confidence=score,
                            framework="SHARED"
                        ))
                    elif lbl in ["street address", "city", "location"]:
                        matches.append(PIIMatch(
                            entity_type="GEO_DATA",
                            category_id=2,
                            category_name=self.CATEGORIES[2],
                            start=start,
                            end=end,
                            text=ent_text,
                            confidence=score,
                            framework="SHARED"
                        ))
                    elif lbl in ["admission date", "discharge date", "date of birth"]:
                        matches.append(PIIMatch(
                            entity_type="INDIVIDUAL_DATE",
                            category_id=3,
                            category_name=self.CATEGORIES[3],
                            start=start,
                            end=end,
                            text=ent_text,
                            confidence=score,
                            framework="HIPAA" if check_hipaa else "SHARED"
                        ))
                    elif lbl == "salary" and check_dpdp:
                        matches.append(PIIMatch(
                            entity_type="SALARY",
                            category_id=10,
                            category_name=self.CATEGORIES[10],
                            start=start,
                            end=end,
                            text=ent_text,
                            confidence=score,
                            framework="DPDP"
                        ))
                    elif lbl == "student roll number" and check_dpdp:
                        matches.append(PIIMatch(
                            entity_type="STUDENT_ID",
                            category_id=11,
                            category_name=self.CATEGORIES[11],
                            start=start,
                            end=end,
                            text=ent_text,
                            confidence=score,
                            framework="DPDP"
                        ))
                gliner_handled = True
            except Exception as e:
                print(f"GLiNER prediction error, falling back to heuristic: {e}")
                gliner_handled = False

        if not gliner_handled:
            # Fallback to context-anchored heuristic regex and dictionary scrubbing
            _add(self.regex_address, "GEO_DATA", 2, 0.92, "SHARED")
            _add(self.regex_city_county, "GEO_DATA", 2, 0.88, "SHARED")
            _add(self.regex_individual_date, "INDIVIDUAL_DATE", 3, 0.94, "SHARED")
            if check_hipaa:
                _add(self.regex_medical_date, "INDIVIDUAL_DATE", 3, 0.94, "HIPAA")
            if check_dpdp:
                _add(self.regex_salary, "SALARY", 10, 0.92, "DPDP")
                _add(self.regex_student_id, "STUDENT_ID", 11, 0.92, "DPDP")
                _add(self.regex_age_gender, "AGE_GENDER", 3, 0.90, "DPDP")
                _add(self.regex_gps, "GEO_DATA", 2, 0.95, "DPDP")
            # Name context heuristic
            for m in self.regex_name_context.finditer(text):
                full_match = m.group(0)
                name_part = m.group(1) if m.lastindex and m.lastindex >= 1 else full_match
                start_idx = m.start(1) if m.lastindex and m.lastindex >= 1 else m.start()
                end_idx = m.end(1) if m.lastindex and m.lastindex >= 1 else m.end()
                matches.append(PIIMatch(
                    entity_type="NAME",
                    category_id=1,
                    category_name=self.CATEGORIES[1],
                    start=start_idx,
                    end=end_idx,
                    text=name_part,
                    confidence=0.91,
                    framework="SHARED"
                ))
            if aggressive_names:
                for m in self.regex_name_run.finditer(text):
                    tokens = [(t.group(0), t.start(), t.end()) for t in re.finditer(r'\S+', m.group(0))]
                    while tokens and tokens[0][0].lower() in self.NAME_STOP:
                        tokens.pop(0)
                    while tokens and tokens[-1][0].lower() in self.NAME_STOP:
                        tokens.pop()
                    if len(tokens) < 2 or any(t[0].lower() in self.NAME_STOP for t in tokens):
                        continue
                    start, end = m.start() + tokens[0][1], m.start() + tokens[-1][2]
                    matches.append(PIIMatch("NAME", 1, self.CATEGORIES[1], start, end, text[start:end], 0.85, "SHARED"))

        # Optional Presidio NLP
        if self.presidio_analyzer:
            try:
                results = self.presidio_analyzer.analyze(
                    text=text,
                    entities=["PERSON", "LOCATION", "NRP", "DATE_TIME"],
                    language="en"
                )
                for res in results:
                    if res.entity_type == "PERSON":
                        matches.append(PIIMatch(
                            entity_type="NAME",
                            category_id=1,
                            category_name=self.CATEGORIES[1],
                            start=res.start,
                            end=res.end,
                            text=text[res.start:res.end],
                            confidence=res.score,
                            framework="SHARED"
                        ))
                    elif res.entity_type in ["LOCATION", "GPE"]:
                        matches.append(PIIMatch(
                            entity_type="GEO_DATA",
                            category_id=2,
                            category_name=self.CATEGORIES[2],
                            start=res.start,
                            end=res.end,
                            text=text[res.start:res.end],
                            confidence=res.score,
                            framework="SHARED"
                        ))
            except Exception:
                pass

        # Text we already masked ([REDACTED_PAN], [HASH:ab12cd34], [REMOVED: ...]) must not be detected again: a second pass
        # (a masked tool result becomes part of the next prompt) would otherwise label the placeholder word as a name.
        spans = [m.span() for m in re.finditer(r"\[(?:REDACTED_[A-Z_]+|HASH:[0-9a-f]{8}|REMOVED:[^\]]*)\]", text)]
        if spans:
            matches = [m for m in matches if not any(m.start < e and m.end > s for s, e in spans)]

        # Deduplicate and remove overlapping ranges (keep highest confidence / longest match)
        sorted_matches = sorted(matches, key=lambda x: (x.start, -(x.end - x.start), -x.confidence))
        filtered: List[PIIMatch] = []
        last_end = -1

        for m in sorted_matches:
            if m.start >= last_end:
                filtered.append(m)
                last_end = m.end

        return filtered
