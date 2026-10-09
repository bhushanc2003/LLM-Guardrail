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
        self._init_presidio()

    def _init_presidio(self):
        """Try initializing Microsoft Presidio / SpaCy if enabled via env var."""
        self.presidio_analyzer = None
        import os
        if os.getenv("ENABLE_PRESIDIO", "false").lower() == "true":
            try:
                import spacy
                if spacy.util.is_package("en_core_web_sm"):
                    from presidio_analyzer import AnalyzerEngine
                    self.presidio_analyzer = AnalyzerEngine()
            except Exception:
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

    def detect(self, text: str, check_hipaa: bool = True, check_dpdp: bool = True) -> List[PIIMatch]:
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
        _add(self.regex_device_sn, "DEVICE_ID", 13, 0.93, "SHARED")
        _add(self.regex_phone, "PHONE", 4, 0.90, "SHARED")
        _add(self.regex_address, "GEO_DATA", 2, 0.92, "SHARED")
        _add(self.regex_city_county, "GEO_DATA", 2, 0.88, "SHARED")
        _add(self.regex_individual_date, "INDIVIDUAL_DATE", 3, 0.94, "SHARED")

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

        # ----------------------------------------------------
        # 2. EVALUATE HIPAA SPECIFIC PATTERNS
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
            _add(self.regex_medical_date, "INDIVIDUAL_DATE", 3, 0.94, "HIPAA")

        # ----------------------------------------------------
        # 3. EVALUATE DPDP SPECIFIC PATTERNS (India Act 2023)
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
            _add(self.regex_salary, "SALARY", 10, 0.92, "DPDP")
            _add(self.regex_student_id, "STUDENT_ID", 11, 0.92, "DPDP")
            _add(self.regex_age_gender, "AGE_GENDER", 3, 0.90, "DPDP")
            _add(self.regex_gps, "GEO_DATA", 2, 0.95, "DPDP")
            _add(self.regex_ifsc, "ACCOUNT_NUMBER", 10, 0.92, "DPDP")

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

        # Deduplicate and remove overlapping ranges (keep highest confidence / longest match)
        sorted_matches = sorted(matches, key=lambda x: (x.start, -(x.end - x.start), -x.confidence))
        filtered: List[PIIMatch] = []
        last_end = -1

        for m in sorted_matches:
            if m.start >= last_end:
                filtered.append(m)
                last_end = m.end

        return filtered
