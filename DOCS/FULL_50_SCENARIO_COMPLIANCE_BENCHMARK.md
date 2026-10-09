# Full 50-Scenario Compliance Benchmark Report

**Test Suite:** 5 Dedicated Test Cases for each of the 10 Core Identifiers (5 HIPAA + 5 DPDP = 50 Scenarios Total)
**Comparison:** Normal Fast-Path (Advanced Mode OFF) vs. Neural SLM (Advanced Mode ON)
**Auditing Columns:** Tracks exactly what was missed by the Normal method, and what was missed or extra-detected by the Advanced filter.
**Date:** October 10, 2026

---

## HIPAA - Social Security Number (SSN)

| Case # | Prompt | Detected with Normal Method (Fast-Path) | Detected with Advanced Filter (Neural SLM) | Missed by Normal Method | Missed by Advanced / Extra Detected | Normal Latency | Advanced Latency |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | *"Patient enrollment verified under SSN: 987-65-4320 for Medicaid records."* | • SSN (SSN: 987-65-4320) | • NAME (Patient)<br>• SSN (SSN: 987-65-4320) | None (Primary SSN caught) | Extra: "Patient" context token | **0.2 ms** | **58.94 ms** |
| **2** | *"Discharge paperwork lists patient social security 123-45-6789 without masking."* | • SSN (social security 123-45-6789) | • SSN (social security 123-45-6789) | None (Primary SSN caught) | None | **0.17 ms** | **48.71 ms** |
| **3** | *"Direct insurance match for SSN 456-78-1234 requested by Saint Mary Clinic."* | • SSN (SSN 456-78-1234) | • SSN (SSN 456-78-1234)<br>• GEO_DATA (Saint Mary Clinic) | Missed facility: "Saint Mary Clinic" | Extra: "Saint Mary Clinic" (Facility) | **0.19 ms** | **44.64 ms** |
| **4** | *"Emergency contact for John Doe filed under SSN: 890-12-3456 in Seattle."* | • SSN (SSN: 890-12-3456) | • NAME (John Doe)<br>• SSN (SSN: 890-12-3456)<br>• GEO_DATA (Seattle) | Missed bare name: "John Doe" & city: "Seattle" | None (Caught SSN, Name, City) | **0.16 ms** | **44.39 ms** |
| **5** | *"Non-SSN tracking: Part number 987-65-4320-X and invoice 123-45-678 is standard equipment."* | • SSN (987-65-4320) | • SSN (987-65-4320) | None (Part SKU 987-65-4320-X matched SSN substring) | None (Matched SSN substring) | **0.6 ms** | **56.57 ms** |

---

## HIPAA - Medical Record Number (MRN)

| Case # | Prompt | Detected with Normal Method (Fast-Path) | Detected with Advanced Filter (Neural SLM) | Missed by Normal Method | Missed by Advanced / Extra Detected | Normal Latency | Advanced Latency |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | *"Patient charts indexed under MRN: 9048210 for immediate transfer to cardiology."* | • MRN (MRN: 9048210) | • NAME (Patient)<br>• MRN (MRN: 9048210) | None (Primary MRN caught) | Extra: "Patient" context token | **0.74 ms** | **49.31 ms** |
| **2** | *"Please pull historical lab results for file MRN-3829104 from oncology archives."* | • MRN (MRN-3829104) | • MRN (MRN-3829104)<br>• GEO_DATA (oncology archives) | None (Primary MRN caught) | Extra: "oncology archives" (Geo) | **0.16 ms** | **48.63 ms** |
| **3** | *"Discharge summary signed under Med Rec # 7492015 by the attending physician."* | • MRN (Med Rec # 7492015) | • MRN (Med Rec # 7492015)<br>• NAME (attending physician) | None (Primary MRN caught) | Extra: "attending physician" (Role token) | **0.24 ms** | **52.22 ms** |
| **4** | *"Update clinical record for Sarah Connor cataloged under Medical Record Number 5829103 at Princeton Hospital."* | • MRN (Medical Record Number 5829103) | • NAME (Sarah Connor)<br>• MRN (Medical Record Number 5829103)<br>• GEO_DATA (Princeton Hospital) | Missed bare name: "Sarah Connor" & facility: "Princeton Hospital" | None (Caught MRN, Name, Facility) | **0.2 ms** | **42.03 ms** |
| **5** | *"Tracking package tracking number FEDEX-9048210 and invoice INV-3829104 for laboratory supply order."* | *None (Clean pass-through)* | *None (Clean pass-through)* | None (Negative Control Clean) | None (Negative Control Clean) | **0.19 ms** | **40.7 ms** |

---

## HIPAA - Health Plan Beneficiary ID

| Case # | Prompt | Detected with Normal Method (Fast-Path) | Detected with Advanced Filter (Neural SLM) | Missed by Normal Method | Missed by Advanced / Extra Detected | Normal Latency | Advanced Latency |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | *"Verify coverage under Health Plan Beneficiary ID HICN-8947201-B for annual wellness check."* | • HEALTH_BENEFICIARY_ID (Health Plan Beneficiary) | • HEALTH_BENEFICIARY_ID (Health Plan Beneficiary) | None (Primary Beneficiary ID caught) | None | **0.19 ms** | **46.14 ms** |
| **2** | *"Insurance policy active under Member ID: POL-99882234 with Blue Cross."* | • HEALTH_BENEFICIARY_ID (Member ID: POL-99882234) | • HEALTH_BENEFICIARY_ID (Member ID: POL-99882234) | None (Primary Member ID caught) | None | **0.15 ms** | **45.53 ms** |
| **3** | *"Prior authorization requested for Medicare ID 1EG4-TE5-MK72 by pediatric ward."* | • HEALTH_BENEFICIARY_ID (Medicare ID 1EG4-TE5-MK72) | • HEALTH_BENEFICIARY_ID (Medicare ID 1EG4-TE5-MK72)<br>• GEO_DATA (pediatric ward) | Missed facility: "pediatric ward" | Extra: "pediatric ward" (Geo) | **0.17 ms** | **37.71 ms** |
| **4** | *"Policyholder Elena Rostova submitted Policy # 445566778 for orthopedic surgery."* | • HEALTH_BENEFICIARY_ID (Policy # 445566778) | • NAME (Elena Rostova)<br>• HEALTH_BENEFICIARY_ID (Policy # 445566778) | Missed bare policyholder name: "Elena Rostova" | None (Caught Policy # & Elena Rostova) | **0.15 ms** | **37.68 ms** |
| **5** | *"System batch reference ID POL-123 and ticket ID 99882234 closed in customer portal."* | *None (Clean pass-through)* | *None (Clean pass-through)* | None (Negative Control Clean) | None (Negative Control Clean) | **0.16 ms** | **74.0 ms** |

---

## HIPAA - Individual & Clinical Dates

| Case # | Prompt | Detected with Normal Method (Fast-Path) | Detected with Advanced Filter (Neural SLM) | Missed by Normal Method | Missed by Advanced / Extra Detected | Normal Latency | Advanced Latency |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | *"Inpatient admission confirmed: Admitted: 03/12/2024 for acute myocardial infarction."* | • INDIVIDUAL_DATE (Admitted: 03/12/2024) | • INDIVIDUAL_DATE (03/12/2024) | None (Admission date caught) | None (Admission date caught) | **0.18 ms** | **37.38 ms** |
| **2** | *"Patient discharge logged as Discharged on 11/24/2023 with home hospice care."* | • INDIVIDUAL_DATE (11/24/2023) | • NAME (Patient)<br>• INDIVIDUAL_DATE (11/24/2023) | None (Discharge date caught) | Extra: "Patient" context token | **0.16 ms** | **36.92 ms** |
| **3** | *"Pediatric patient born on DOB: 07/15/1998 requires allergy sensitivity test."* | • INDIVIDUAL_DATE (DOB: 07/15/1998) | • NAME (Pediatric patient) | None (DOB date caught) | Missed raw date token; Extra: "Pediatric patient" | **0.15 ms** | **36.68 ms** |
| **4** | *"Surgical schedule for Robert Chen lists Surgery Date: 05/18/2024 at 08:00 AM."* | • INDIVIDUAL_DATE (Surgery Date: 05/18/2024) | • NAME (Robert Chen)<br>• INDIVIDUAL_DATE (05/18/2024) | Missed patient name: "Robert Chen" | None (Caught Date & Robert Chen) | **0.16 ms** | **38.11 ms** |
| **5** | *"Historical medical discovery occurred in 1995 while standard protocols updated in 2021."* | *None (Clean pass-through)* | *None (Clean pass-through)* | None (Negative Control Clean; Years preserved) | None (Negative Control Clean; Years preserved) | **0.17 ms** | **37.39 ms** |

---

## HIPAA - Healthcare Provider & Patient Names

| Case # | Prompt | Detected with Normal Method (Fast-Path) | Detected with Advanced Filter (Neural SLM) | Missed by Normal Method | Missed by Advanced / Extra Detected | Normal Latency | Advanced Latency |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | *"Dr. Gregory House admitted patient Allison Cameron to intensive care unit."* | • NAME (Gregory House)<br>• NAME (Allison Cameron) | • NAME (Dr. Gregory House)<br>• NAME (Allison Cameron)<br>• GEO_DATA (intensive care unit) | None (Both Dr. Gregory House & Allison Cameron caught) | Extra: "intensive care unit" (Geo) | **0.15 ms** | **36.52 ms** |
| **2** | *"Urgent neurology consult scheduled for Marcus Vance regarding migraine symptoms."* | *None (Clean pass-through)* | • NAME (Marcus Vance) | Missed bare patient name: "Marcus Vance" | None (Caught Marcus Vance) | **0.14 ms** | **35.84 ms** |
| **3** | *"Nurse practitioner Sarah J. Connor completed rounds in wing 4B."* | *None (Clean pass-through)* | • NAME (Nurse practitioner)<br>• NAME (Sarah J. Connor)<br>• GEO_DATA (wing 4B) | Missed middle initial nurse name: "Sarah J. Connor" | Extra: "Nurse practitioner" & "wing 4B" | **0.12 ms** | **36.06 ms** |
| **4** | *"Clinical encounter notes for Emily Watson indicate positive recovery post-op."* | *None (Clean pass-through)* | • NAME (Emily Watson) | Missed unstructured patient name: "Emily Watson" | None (Caught Emily Watson) | **0.13 ms** | **38.99 ms** |
| **5** | *"Prescription protocol: Tamoxifen 20mg twice daily with Metoprolol and Lisinopril."* | *None (Clean pass-through)* | *None (Clean pass-through)* | None (Negative Control Clean; Medications preserved) | None (Negative Control Clean; Medications preserved) | **0.15 ms** | **36.84 ms** |

---

## DPDP - Aadhaar Number (12-Digit UID)

| Case # | Prompt | Detected with Normal Method (Fast-Path) | Detected with Advanced Filter (Neural SLM) | Missed by Normal Method | Missed by Advanced / Extra Detected | Normal Latency | Advanced Latency |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | *"Identity verification submitted with Aadhaar: 4532 8901 2345 for digital KYC approval."* | • AADHAAR (Aadhaar: 4532 8901 2345) | • AADHAAR (Aadhaar: 4532 8901 2345) | None (Primary Aadhaar caught) | None | **0.18 ms** | **37.06 ms** |
| **2** | *"Beneficiary subsidy transferred directly to account 6721 8934 1092 under direct benefit scheme."* | • AADHAAR (6721 8934 1092) | • AADHAAR (6721 8934 1092) | None (Unanchored 12-digit UID caught) | None | **0.19 ms** | **36.82 ms** |
| **3** | *"National identity document issued by UIDAI: 7890-1234-5678 presented at bank counter."* | • AADHAAR (UIDAI: 7890-1234-5678) | • AADHAAR (UIDAI: 7890-1234-5678)<br>• GEO_DATA (bank counter) | None (Hyphenated Aadhaar caught) | Extra: "bank counter" (Geo) | **0.17 ms** | **39.01 ms** |
| **4** | *"Please process onboarding credentials for Rahul Sharma holding Aadhaar 9123 4567 8901 in Kolkata."* | • AADHAAR (Aadhaar 9123 4567 8901) | • NAME (Rahul Sharma)<br>• AADHAAR (Aadhaar 9123 4567 8901)<br>• GEO_DATA (Kolkata) | Missed bare name: "Rahul Sharma" & city: "Kolkata" | None (Caught Aadhaar, Rahul Sharma, Kolkata) | **0.19 ms** | **36.9 ms** |
| **5** | *"Transaction reference ID 1098 7654 3210 and batch timestamp 0123 4567 8901 generated by payment server."* | *None (Clean pass-through)* | *None (Clean pass-through)* | None (Negative Control Clean; First digit [2-9] enforced) | None (Negative Control Clean) | **0.21 ms** | **38.1 ms** |

---

## DPDP - Permanent Account Number (PAN)

| Case # | Prompt | Detected with Normal Method (Fast-Path) | Detected with Advanced Filter (Neural SLM) | Missed by Normal Method | Missed by Advanced / Extra Detected | Normal Latency | Advanced Latency |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | *"Income tax assessment notice issued to taxpayer holding PAN: ABCDE1234F for assessment year."* | • PAN (PAN: ABCDE1234F) | • NAME (taxpayer)<br>• PAN (PAN: ABCDE1234F) | None (Primary PAN caught) | Extra: "taxpayer" (Role token) | **0.17 ms** | **37.29 ms** |
| **2** | *"Corporate vendor verification requires company PAN BKZPC8821M before contract dispatch."* | • PAN (PAN BKZPC8821M) | • PAN (PAN BKZPC8821M) | None (Corporate PAN caught) | None | **0.16 ms** | **37.91 ms** |
| **3** | *"Financial audit flagged annual return filed under pan card FGHIJ5678K with pending penalty."* | • PAN (pan card FGHIJ5678K) | • PAN (pan card FGHIJ5678K) | None (Audit PAN caught) | None | **0.17 ms** | **41.81 ms** |
| **4** | *"Onboarding documentation for Vikram Malhotra with PAN: PLMNB9988Q in Bangalore."* | • PAN (PAN: PLMNB9988Q) | • NAME (Vikram Malhotra)<br>• PAN (PAN: PLMNB9988Q)<br>• GEO_DATA (Bangalore) | Missed bare name: "Vikram Malhotra" & city: "Bangalore" | None (Caught PAN, Vikram Malhotra, Bangalore) | **0.22 ms** | **38.65 ms** |
| **5** | *"Alphanumeric product stock SKU ABCDE12345 and warehouse tag FGHIJ56780 scanned."* | *None (Clean pass-through)* | *None (Clean pass-through)* | None (Negative Control Clean; Non-letter 10th char rejected) | None (Negative Control Clean) | **0.15 ms** | **36.96 ms** |

---

## DPDP - Unified Payments Interface (UPI ID)

| Case # | Prompt | Detected with Normal Method (Fast-Path) | Detected with Advanced Filter (Neural SLM) | Missed by Normal Method | Missed by Advanced / Extra Detected | Normal Latency | Advanced Latency |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | *"Remit freelance invoice payment of INR 25,000 to rahul@okaxis upon project milestone."* | • UPI_ID (rahul@okaxis) | • UPI_ID (rahul@okaxis) | None (Primary UPI handle caught) | None | **0.17 ms** | **38.94 ms** |
| **2** | *"Customer refund processed to VPA handle aditi.sharma@okhdfcbank with instant settlement."* | • UPI_ID (aditi.sharma@okhdfcbank) | • UPI_ID (aditi.sharma@okhdfcbank) | None (VPA handle caught) | None | **0.16 ms** | **39.88 ms** |
| **3** | *"Vendor payment portal received UPI ID payment from shopkeeper99@paytm for wholesale delivery."* | • UPI_ID (shopkeeper99@paytm) | • UPI_ID (shopkeeper99@paytm) | None (Paytm UPI handle caught) | None | **0.17 ms** | **36.97 ms** |
| **4** | *"Settlement transfer sent to priya.nair@oksbi from ICICI branch in Chennai."* | • UPI_ID (priya.nair@oksbi) | • UPI_ID (priya.nair@oksbi)<br>• GEO_DATA (Chennai) | Missed city: "Chennai" | Extra: "Chennai" (City Geo) | **0.14 ms** | **36.82 ms** |
| **5** | *"Email query sent to support@okaxis.com regarding corporate domain registration."* | • EMAIL (support@okaxis.com) | • EMAIL (support@okaxis.com) | None (Domain email caught) | None | **0.15 ms** | **36.64 ms** |

---

## DPDP - Indian PIN Code & City Locality

| Case # | Prompt | Detected with Normal Method (Fast-Path) | Detected with Advanced Filter (Neural SLM) | Missed by Normal Method | Missed by Advanced / Extra Detected | Normal Latency | Advanced Latency |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | *"Registered office address at 42 Park Street, Kolkata, PIN: 700016 for tax jurisdiction."* | • GEO_DATA (address at 42 Park Street)<br>• PIN_CODE (PIN: 700016) | • GEO_DATA (42 Park Street)<br>• GEO_DATA (Kolkata)<br>• PIN_CODE (PIN: 700016) | Missed city: "Kolkata" | None (Caught Address, Kolkata, PIN) | **0.18 ms** | **37.88 ms** |
| **2** | *"Legal courier dispatch directed to 15 MG Road, Bangalore, Postal Code: 560001."* | • GEO_DATA (15 MG Road)<br>• PIN_CODE (Postal Code: 560001) | • GEO_DATA (15 MG Road)<br>• GEO_DATA (Bangalore)<br>• PIN_CODE (Postal Code: 560001) | Missed city: "Bangalore" | None (Caught Address, Bangalore, PIN) | **0.16 ms** | **36.78 ms** |
| **3** | *"Warehouse storage facility operating in Pune, PIN Code: 411001 with 24/7 security."* | • PIN_CODE (PIN Code: 411001) | • GEO_DATA (Pune)<br>• PIN_CODE (PIN Code: 411001) | Missed city: "Pune" | None (Caught Pune & PIN) | **0.16 ms** | **37.02 ms** |
| **4** | *"Residential correspondence delivery to Anna Nagar, Chennai, Pin 600040 for resident Ananya."* | • PIN_CODE (Pin 600040) | • GEO_DATA (Anna Nagar)<br>• GEO_DATA (Chennai)<br>• PIN_CODE (Pin 600040)<br>• NAME (Ananya) | Missed locality: "Anna Nagar", city: "Chennai", name: "Ananya" | None (Caught Locality, City, PIN, Name) | **0.17 ms** | **37.15 ms** |
| **5** | *"Standard catalog product model 600040 and manufacturing batch 700016 ready for export."* | *None (Clean pass-through)* | *None (Clean pass-through)* | None (Negative Control Clean; Catalog numbers preserved) | None (Negative Control Clean) | **0.16 ms** | **36.72 ms** |

---

## DPDP - Salary / Compensation & CTC

| Case # | Prompt | Detected with Normal Method (Fast-Path) | Detected with Advanced Filter (Neural SLM) | Missed by Normal Method | Missed by Advanced / Extra Detected | Normal Latency | Advanced Latency |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **1** | *"Employment offer letter specifies an annual salary package of INR 24 LPA with stock grants."* | *None (Clean pass-through)* | • SALARY (INR 24 LPA) | Missed unanchored salary: "INR 24 LPA" | None (Caught INR 24 LPA) | **0.17 ms** | **37.49 ms** |
| **2** | *"Executive hiring contract confirmed at fixed CTC: Rs. 35,00,000 per annum in Gurgaon."* | *None (Clean pass-through)* | • SALARY (Rs. 35,00,000)<br>• GEO_DATA (Gurgaon) | Missed CTC & city: "Gurgaon" | None (Caught CTC & Gurgaon) | **0.17 ms** | **37.78 ms** |
| **3** | *"Summer internship stipend approved at Salary: INR 45,000 per month for software intern."* | • SALARY (Salary: INR 45,000 per month) | • SALARY (Salary)<br>• SALARY (INR 45,000)<br>• NAME (software intern) | None (Anchored Salary caught) | Extra: "software intern" (Role token) | **0.16 ms** | **37.18 ms** |
| **4** | *"Candidate Rohan Kulkarni accepted compensation of ₹18.5 LPA in Mumbai office."* | *None (Clean pass-through)* | • NAME (Candidate)<br>• NAME (Rohan Kulkarni)<br>• SALARY (₹18.5 LPA)<br>• GEO_DATA (Mumbai)<br>• GEO_DATA (office) | Missed bare name: "Rohan Kulkarni", salary: "₹18.5 LPA", city: "Mumbai" | Extra: "Candidate" & "office" | **0.28 ms** | **37.03 ms** |
| **5** | *"Budget allocation of INR 50 Crores approved for state infrastructure development project."* | • GEO_DATA (location of INR 50 Crores approved for state infrastructure development project.) | *None (Clean pass-through)* | False Positive: Misclassified state budget line as Geo | None (Clean pass-through; Budget preserved) | **0.17 ms** | **38.26 ms** |

---
