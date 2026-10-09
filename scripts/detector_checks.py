#!/usr/bin/env python3
"""Quick accuracy check for the PII detector. Run with the NER pass on:
    ENABLE_PRESIDIO=true python scripts/detector_checks.py
Each case: text, and the substrings that MUST NOT survive redaction.
"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pii_proxy.anonymizer import PIIAnonymizer, PIISessionVault
from pii_proxy.pii_detector import PIIDetector

CASES = [
    ("Name: Margaret Ellen Whitfield | Phone: (614) 555-0192", ["Margaret", "Whitfield", "555-0192"]),
    ("margaret whitfield called about her refill", ["margaret", "whitfield"]),
    ("Dr. Okafor saw Derrick Osei yesterday in Chicago", ["Okafor", "Derrick", "Osei", "Chicago"]),
    ("Email jane.doe@example.com or call 614-555-0100", ["jane.doe@example.com", "555-0100"]),
    ("SSN 912-34-5678, DOB 03/14/1982", ["912-34-5678", "03/14/1982"]),
    ("Aadhaar 9123 4567 8901, PAN ABCDE1234F, UPI typed.user@examplepay", ["9123 4567 8901", "ABCDE1234F", "typed.user@examplepay"]),
    ("Card 4111 1111 1111 1111 and account 123456789012", ["4111 1111 1111 1111", "123456789012"]),
    ("Passport Z1234567, employee ID EMP-00421", ["Z1234567", "EMP-00421"]),
    ("Server at 10.1.2.3 see https://portal.example.com/patient/42", ["10.1.2.3", "portal.example.com"]),
    ("Insurance ID: BCB-9988776, MRN-000481923", ["BCB-9988776", "MRN-000481923"]),
]
d = PIIDetector(); a = PIIAnonymizer(detector=d)
print("NER on" if d.presidio_analyzer else "NER OFF (regex only)")
bad = 0
for text, secrets in CASES:
    t = time.time(); out, _ = a.process_text(text, PIISessionVault(), mode="REDACT", aggressive_names=True); ms = (time.time() - t) * 1000
    leaks = [s for s in secrets if s in out]
    bad += bool(leaks)
    print(f"{'FAIL' if leaks else 'ok  '} {ms:5.0f}ms {text[:60]!r}" + (f" leaked={leaks}" if leaks else ""))
print(f"{len(CASES) - bad}/{len(CASES)} clean")
sys.exit(1 if bad else 0)
