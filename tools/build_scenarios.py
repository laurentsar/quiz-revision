#!/usr/bin/env python3
"""Mini-scénarios (« mises en situation ») rattachés aux concepts clés par TERME.

Produit www/data/scenarios.json : { terme_normalisé : scénario }. L'app applique
le scénario à tout concept dont le terme normalisé correspond (donc le même
scénario couvre le concept dans toutes les certifs où il apparaît). Un concept
doté d'un `ex` débloque le type de question « mise en situation ».

La normalisation doit rester identique à celle de www/app.js (normEx).
"""
import json
import os
import re
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'www/data/scenarios.json')


def norm(t):
    t = t.lower()
    t = re.sub(r'\([^)]*\)', '', t)          # retire les parenthèses (MFA), (Art. 5)…
    t = re.sub(r'[^a-z0-9à-ÿ]+', ' ', t)     # ponctuation/tirets -> espace
    return re.sub(r'\s+', ' ', t).strip()


# terme -> scénario, DANS LA LANGUE DU THÈME : anglais pour les concepts de
# certification (examens en anglais), français pour les termes français
# (RGPD, secret défense). La clé est normalisée à l'écriture.
SCENARIOS = {
    # — Principles (EN) —
    'Confidentiality': "An HR file is encrypted so only authorized managers can read it.",
    'Integrity': "A system checks a downloaded file's hash to confirm it was not altered.",
    'Availability': "Redundant servers are deployed so the service stays reachable if one fails.",
    'Non-repudiation': "A contract is digitally signed, so the sender cannot later deny sending it.",
    'Least Privilege': "An intern is given read-only access to just the folder they need, nothing more.",
    'Defense in Depth': "Firewall, antivirus and strong authentication stack up so one flaw is not enough.",
    'Separation of Duties': "The person who enters an invoice cannot also approve it, to prevent fraud.",
    'Need to Know': "A Secret-cleared officer only accesses the files strictly required for their mission.",
    'Accountability': "Every sensitive action is logged and tied to the user who performed it.",
    'Due Care': "The company deploys reasonable protections, as a prudent actor would.",
    'Due Diligence': "The team regularly verifies that security measures remain effective over time.",

    # — Access (EN) —
    'Multi-Factor Authentication (MFA)': "To log in, the user enters a password and then a code sent to their phone.",
    'Role-Based Access Control (RBAC)': "Rights are assigned by job function: every accountant has the same access.",
    'Discretionary Access Control (DAC)': "The owner of a file decides who may access it.",
    'Mandatory Access Control (MAC)': "The system enforces access from classification labels; users cannot override it.",
    'Single Sign-On (SSO)': "One login grants access to email, intranet and HR applications.",
    'Privilege Escalation': "An attacker exploits a flaw to move from a user account to an administrator account.",
    'Privileged Access Management (PAM)': "Administrator accounts are vaulted and their sessions recorded.",
    'Biometrics': "Access to the server room is granted by fingerprint.",
    'Provisioning': "When an employee joins, their accounts and access are created automatically for their role.",
    'Deprovisioning': "When an employee leaves, all their access is revoked immediately.",

    # — Risk (EN) —
    'Risk Acceptance': "Management chooses to live with a low risk rather than invest to reduce it.",
    'Risk Avoidance': "A risky feature is dropped to eliminate the risk entirely.",
    'Risk Mitigation': "A firewall is installed to lower the likelihood of an intrusion.",
    'Risk Transference': "The company buys cyber-insurance to transfer part of the risk.",
    'Residual Risk': "After all controls are applied, a remaining level of risk is documented.",
    'Annualized Loss Expectancy (ALE)': "Expected yearly loss is estimated by multiplying loss per incident by its annual frequency.",
    'Business Impact Analysis (BIA)': "Critical functions and the impact of their outage are identified before building the continuity plan.",

    # — Crypto (EN) —
    'Symmetric Encryption': "Two parties share one secret key to encrypt and decrypt their exchanges.",
    'Asymmetric Encryption': "A message is encrypted with the recipient's public key; only their private key decrypts it.",
    'Hashing': "A password's irreversible fingerprint is stored instead of the password itself.",
    'Digital Signature': "A document is cryptographically signed, proving its author and integrity.",
    'Public Key Infrastructure (PKI)': "A certificate authority issues and manages the organization's digital certificates.",
    'Salt': "A random value is added to each password before hashing to defeat precomputed tables.",
    'TLS': "The browser padlock shows the connection to the site is encrypted in transit.",

    # — Network (EN) —
    'Firewall': "A device filters traffic between the internal network and the Internet using rules.",
    'Intrusion Detection System (IDS)': "A sensor analyses traffic and alerts the team on suspicious activity, without blocking it.",
    'Intrusion Prevention System (IPS)': "A device detects a network attack and blocks it automatically.",
    'VPN': "A remote worker sets up an encrypted tunnel to reach the corporate network.",
    'Demilitarized Zone (DMZ)': "The public web server is placed in a buffer subnet, isolated from the internal network.",
    'Network Segmentation': "The industrial network is separated from the office network to limit an attack's spread.",
    'Zero Trust': "No connection is implicitly trusted: every access is verified, even internally.",
    'Network Access Control (NAC)': "A device must prove its compliance before being admitted to the network.",

    # — Attacks (EN) —
    'Phishing': "A fraudulent email imitates the bank to trick the victim into entering their credentials.",
    'Spear Phishing': "A highly personalized email targets the chief financial officer specifically.",
    'SQL Injection': "An attacker inserts SQL into a form field to read the database.",
    'Cross-Site Scripting (XSS)': "A malicious script is injected into a page and runs in other visitors' browsers.",
    'Ransomware': "Software encrypts the company's files and demands a ransom to release them.",
    'Social Engineering': "A stranger poses as IT support to obtain a password.",
    'Piggybacking / Tailgating': "An unauthorized person enters the premises by following an employee who badged in.",
    'Evil Twin': "A rogue Wi-Fi access point imitates the hotel's to intercept guests' traffic.",
    'Pass-the-Hash': "The attacker authenticates with a stolen password hash, without knowing the password.",
    'Man-in-the-Middle (MITM)': "An attacker sits between two parties to eavesdrop on their communication.",
    'Distributed Denial-of-Service (DDoS)': "Thousands of machines flood a site with requests to make it unavailable.",
    'Rainbow Table': "The attacker uses a table of precomputed hashes to recover passwords quickly.",
    'Honeypot': "A decoy server is deployed to lure attackers and study their methods.",

    # — Incident / continuity (EN) —
    'Containment': "On detection, the infected machine is isolated from the network to stop the spread.",
    'Eradication': "The malware is removed and the exploited flaw is fixed.",
    'Chain of Custody': "Every handling of an evidence item is logged so it stays admissible in court.",
    'Recovery Time Objective (RTO)': "A 4-hour maximum is set to restore the service after an outage.",
    'Recovery Point Objective (RPO)': "At most 15 minutes of data loss is accepted, which sets the backup frequency.",
    'Hot Site': "A fully equipped alternate site lets operations resume within minutes.",

    # — Cloud (EN) —
    'Shared Responsibility Model': "The provider secures the infrastructure; the customer secures their data and access.",
    'Software as a Service (SaaS)': "The company uses a ready-to-use online mail service with nothing to install.",
    'Infrastructure as a Service (IaaS)': "The team rents virtual servers and manages the operating system itself.",
    'Cloud Access Security Broker (CASB)': "An intermediary enforces security policy between users and cloud services.",
    'Data Sovereignty': "Data hosted in a country is subject to that country's laws.",
    'Tokenization': "A card number is replaced by a token with no exploitable value if stolen.",
    'Data Loss Prevention (DLP)': "A tool blocks emailing a file that contains social security numbers.",

    # — RGPD / secret défense (FR — thèmes français) —
    'Droit à l\'effacement (Art. 17)': "Un client demande la suppression de toutes ses données : l'entreprise doit y donner suite.",
    'Notifier l\'autorité sous 72 h (Art. 33)': "Après une fuite de données, l'entreprise dispose de 72 heures pour prévenir la CNIL.",
    'Analyse d\'impact — AIPD (Art. 35)': "Avant un traitement à risque élevé, on évalue formellement son impact sur la vie privée.",
    'Consentement': "Une case non pré-cochée invite l'utilisateur à accepter explicitement le traitement de ses données.",
    'Habilitation': "Une décision formelle autorise un agent à accéder aux informations classifiées d'un niveau donné.",
    'Homologation d\'un SI classifié': "Une autorité atteste qu'un système atteint le niveau de sécurité requis avant sa mise en service.",
}


def main():
    # validation : chaque terme visé doit exister dans le corpus (sinon coquille)
    present = set()
    for f in glob.glob(os.path.join(ROOT, 'www/data/*concepts*.json')):
        for c in json.load(open(f, encoding='utf-8'))['concepts']:
            present.add(norm(c['term']))

    # les 6 derniers scénarios sont français (RGPD / secret défense) ; le reste anglais.
    FR_TERMS = {norm(t) for t in (
        "Droit à l'effacement (Art. 17)", "Notifier l'autorité sous 72 h (Art. 33)",
        "Analyse d'impact — AIPD (Art. 35)", "Consentement", "Habilitation",
        "Homologation d'un SI classifié")}

    out = {}
    missing = []
    for term, ex in SCENARIOS.items():
        key = norm(term)
        if key in present:
            out[key] = {'lang': 'fr' if key in FR_TERMS else 'en', 'ex': ex}
        else:
            missing.append(term)

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"{len(out)} scénarios rattachés -> {os.path.relpath(OUT, ROOT)}")
    if missing:
        print("  ⚠ termes introuvables (scénario ignoré) :")
        for m in missing:
            print('   -', m)


if __name__ == '__main__':
    main()
