#!/usr/bin/env python3
"""Concepts ISC2 rédigés à la main d'après les référentiels officiels :

  • CISSP Domaine 8 — Software Development Security (absent de la mind map source).
    Aligné sur l'outline CISSP en vigueur au 15 avril 2024.
  • Certification CC (Certified in Cybersecurity) — 5 domaines et sous-domaines de
    l'outline officiel (effectif 29 août 2022).

Contenu en ANGLAIS (les examens ISC2 sont en anglais). Sortie : www/data/isc2_concepts.json.
Les clés `cissp8` rejoignent le groupe CISSP ; `cc1..cc5` forment le groupe « CC (ISC2) ».
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'www/data/isc2_concepts.json')
SOURCE = 'ISC2 official exam outlines — CISSP (15 avr. 2024) & CC (29 août 2022)'

# clé -> (libellé, { sous-domaine : [ (terme, définition), ... ] })
MAPS = {}

# ═══════════════ CISSP Domaine 8 — Software Development Security ═══════════════
MAPS['cissp8'] = ('Software Development Security', {
    'Software Development Life Cycle': [
        ('SDLC', "A structured process for building software: requirements, design, development, testing, deployment and maintenance."),
        ('Waterfall Model', "A sequential SDLC where each phase must finish before the next begins."),
        ('Agile', "An iterative, incremental development approach delivering working software in short cycles."),
        ('DevSecOps', "Integrating security practices and automated testing throughout the DevOps pipeline."),
        ('Requirements Gathering', "Defining functional and security requirements before design begins."),
        ('Change Management', "Controlling changes to code and configuration through documentation, approval and rollback."),
    ],
    'Secure Coding': [
        ('Input Validation', "Checking all input for type, length and format to prevent injection and overflow attacks."),
        ('Output Encoding', "Encoding data before rendering to prevent cross-site scripting (XSS)."),
        ('Secure Coding Standards', "Rules and guidelines (e.g., OWASP, CERT) that reduce common code vulnerabilities."),
        ('Least Privilege', "Granting code and processes only the minimum rights required to function."),
        ('Error Handling', "Failing securely without leaking sensitive information in messages or logs."),
        ('Code Reuse', "Using vetted libraries carefully; third-party components can introduce vulnerabilities."),
    ],
    'Security Testing': [
        ('SAST', "Static Application Security Testing: analyses source code for flaws without executing it."),
        ('DAST', "Dynamic Application Security Testing: probes a running application for vulnerabilities."),
        ('IAST', "Interactive Application Security Testing: combines static and dynamic analysis at runtime."),
        ('Software Composition Analysis (SCA)', "Identifies vulnerabilities and licences in open-source dependencies."),
        ('Fuzzing', "Feeding malformed or random input to reveal crashes and security bugs."),
        ('Penetration Testing', "Simulating attacks against an application to find exploitable weaknesses."),
    ],
    'Application Vulnerabilities': [
        ('OWASP Top 10', "A ranked list of the most critical web application security risks."),
        ('SQL Injection', "Injecting malicious SQL through unvalidated input to manipulate a database."),
        ('Cross-Site Scripting (XSS)', "Injecting scripts into web pages viewed by other users."),
        ('Cross-Site Request Forgery (CSRF)', "Forcing a user's browser to send unwanted authenticated requests."),
        ('Buffer Overflow', "Writing beyond a buffer's bounds to corrupt memory or execute code."),
        ('Insecure Deserialization', "Processing untrusted serialized data, enabling code execution or tampering."),
    ],
    'Assessing Software Security': [
        ('Software Maturity Models', "Frameworks (e.g., CMMI, BSIMM, SAMM) measuring the maturity of security practices."),
        ('Code Repository Security', "Protecting source control (access, secrets, integrity) against tampering and leaks."),
        ('CI/CD Pipeline Security', "Securing automated build and deployment pipelines against compromise."),
        ('Application Programming Interface (API) Security', "Protecting APIs with authentication, authorization, rate limiting and validation."),
        ('Third-Party Software Risk', "Assessing the security of acquired, outsourced or open-source software."),
    ],
})

# ═══════════════ CC — Domain 1: Security Principles ═══════════════
MAPS['cc1'] = ('CC · Security Principles', {
    '1.1 Information Assurance': [
        ('Confidentiality', "Ensuring information is accessible only to those authorized to have access."),
        ('Integrity', "Ensuring information is accurate and has not been altered without authorization."),
        ('Availability', "Ensuring authorized users have reliable and timely access to information."),
        ('Authentication', "Verifying the identity of a user, process or device."),
        ('Multi-Factor Authentication (MFA)', "Authentication using two or more independent factors (know / have / are)."),
        ('Non-repudiation', "Assurance that a party cannot deny the authenticity of their action or signature."),
        ('Privacy', "The right of individuals to control how their personal information is collected and used."),
    ],
    '1.2 Risk Management': [
        ('Risk', "The likelihood of a threat exploiting a vulnerability and the resulting impact."),
        ('Risk Tolerance', "The level of risk an organization is willing to accept."),
        ('Risk Identification', "Recognizing and documenting risks to assets."),
        ('Risk Assessment', "Analysing risks to determine their likelihood and impact."),
        ('Risk Treatment', "Deciding how to handle a risk: accept, avoid, mitigate or transfer."),
    ],
    '1.3 Security Controls': [
        ('Technical Controls', "Controls implemented through technology (e.g., firewalls, encryption, access control)."),
        ('Administrative Controls', "Policies, procedures and training that govern security behaviour."),
        ('Physical Controls', "Controls that protect facilities and hardware (e.g., locks, guards, badges)."),
    ],
    '1.4 & 1.5 Ethics & Governance': [
        ('ISC2 Code of Ethics', "Professional code of conduct all ISC2 members must uphold."),
        ('Policy', "A high-level management statement of security intent and expectations."),
        ('Standard', "A mandatory rule specifying how a policy is to be implemented."),
        ('Procedure', "A step-by-step set of instructions to accomplish a task."),
        ('Regulations and Laws', "Legal requirements an organization must comply with (e.g., GDPR, HIPAA)."),
    ],
})

# ═══════════════ CC — Domain 2: BC / DR / Incident Response ═══════════════
MAPS['cc2'] = ('CC · BC/DR & Incident Response', {
    '2.1 Business Continuity (BC)': [
        ('Business Continuity Plan (BCP)', "A plan to keep critical business functions running during and after a disruption."),
        ('Business Impact Analysis (BIA)', "Identifies critical functions and the impact of their disruption."),
        ('Recovery Time Objective (RTO)', "The maximum acceptable time to restore a function after disruption."),
        ('Recovery Point Objective (RPO)', "The maximum acceptable amount of data loss measured in time."),
    ],
    '2.2 Disaster Recovery (DR)': [
        ('Disaster Recovery Plan (DRP)', "A plan to restore IT systems and data after a major disruption."),
        ('Backup', "A copy of data kept to recover from loss or corruption."),
        ('Recovery Site', "An alternate location (hot, warm or cold) used to resume operations."),
    ],
    '2.3 Incident Response': [
        ('Incident', "An event that actually or potentially harms the confidentiality, integrity or availability of information."),
        ('Incident Response Plan', "Documented procedures to detect, respond to and recover from incidents."),
        ('Detection', "Identifying that a security incident has occurred."),
        ('Response', "Containing, eradicating and recovering from a security incident."),
        ('Computer Security Incident Response Team (CSIRT)', "The team responsible for handling security incidents."),
    ],
})

# ═══════════════ CC — Domain 3: Access Controls Concepts ═══════════════
MAPS['cc3'] = ('CC · Access Controls', {
    '3.1 Physical Access Controls': [
        ('Badge System', "Physical control granting entry via an identification badge."),
        ('Closed-Circuit Television (CCTV)', "Cameras used to monitor and record physical areas."),
        ('Mantrap', "A physical control with two interlocking doors to prevent tailgating."),
        ('Environmental Design (CPTED)', "Designing spaces to deter crime and control access."),
        ('Authorized vs Unauthorized Personnel', "Distinguishing who may access an area from who may not."),
    ],
    '3.2 Logical Access Controls': [
        ('Principle of Least Privilege', "Granting users only the access strictly required for their role."),
        ('Segregation of Duties', "Splitting critical tasks among people to prevent fraud and error."),
        ('Discretionary Access Control (DAC)', "The data owner decides who may access a resource."),
        ('Mandatory Access Control (MAC)', "Access decided by the system based on classification labels."),
        ('Role-Based Access Control (RBAC)', "Access granted according to a user's role in the organization."),
    ],
})

# ═══════════════ CC — Domain 4: Network Security ═══════════════
MAPS['cc4'] = ('CC · Network Security', {
    '4.1 Computer Networking': [
        ('OSI Model', "A seven-layer reference model describing network communication."),
        ('TCP/IP Model', "The four-layer protocol suite underpinning the Internet."),
        ('IPv4', "32-bit Internet Protocol addressing scheme."),
        ('IPv6', "128-bit Internet Protocol addressing scheme, successor to IPv4."),
        ('Port', "A numbered endpoint identifying a specific network service."),
    ],
    '4.2 Threats and Attacks': [
        ('Distributed Denial-of-Service (DDoS)', "Overwhelming a target with traffic from many sources to disrupt service."),
        ('Virus', "Malware that attaches to a host file and spreads when executed."),
        ('Worm', "Self-replicating malware that spreads without user action."),
        ('Trojan', "Malware disguised as legitimate software."),
        ('Man-in-the-Middle (MITM)', "Intercepting and possibly altering communication between two parties."),
        ('Intrusion Detection System (IDS)', "Monitors traffic and alerts on suspicious activity."),
        ('Intrusion Prevention System (IPS)', "Detects and actively blocks malicious traffic."),
    ],
    '4.3 Security Infrastructure': [
        ('Demilitarized Zone (DMZ)', "A buffer subnet exposing public services while shielding the internal network."),
        ('Virtual Local Area Network (VLAN)', "Logical segmentation of a network at layer 2."),
        ('Virtual Private Network (VPN)', "An encrypted tunnel over a public network."),
        ('Defense in Depth', "Layering multiple security controls so no single failure is fatal."),
        ('Network Access Control (NAC)', "Enforcing policy on devices before granting network access."),
        ('Software as a Service (SaaS)', "Cloud model delivering ready-to-use applications over the Internet."),
        ('Infrastructure as a Service (IaaS)', "Cloud model providing virtualized compute, storage and network."),
        ('Platform as a Service (PaaS)', "Cloud model providing a platform to build and deploy applications."),
    ],
})

# ═══════════════ CC — Domain 5: Security Operations ═══════════════
MAPS['cc5'] = ('CC · Security Operations', {
    '5.1 Data Security': [
        ('Symmetric Encryption', "Encryption using the same key to encrypt and decrypt."),
        ('Asymmetric Encryption', "Encryption using a public/private key pair."),
        ('Hashing', "A one-way function producing a fixed-length fingerprint of data."),
        ('Data Classification', "Labeling data by sensitivity to apply appropriate protection."),
        ('Data Retention', "Policy defining how long data is kept before disposal."),
        ('Logging and Monitoring', "Recording and reviewing events to detect and investigate incidents."),
    ],
    '5.2 System Hardening': [
        ('Configuration Management', "Maintaining systems in a known, secure state via baselines and updates."),
        ('Baseline', "A minimum secure configuration standard for a system."),
        ('Patch Management', "Applying updates to fix vulnerabilities and bugs."),
    ],
    '5.3 Security Policies': [
        ('Acceptable Use Policy (AUP)', "Rules defining acceptable use of organizational systems."),
        ('Password Policy', "Rules governing password strength, rotation and reuse."),
        ('Bring Your Own Device (BYOD) Policy', "Rules for using personal devices for work."),
        ('Change Management Policy', "Documentation, approval and rollback rules for changes."),
        ('Privacy Policy', "How the organization collects, uses and protects personal data."),
    ],
    '5.4 Security Awareness Training': [
        ('Security Awareness Training', "Educating staff to recognize and respond to security threats."),
        ('Social Engineering', "Manipulating people into divulging information or granting access."),
        ('Password Protection', "Practices that keep credentials secret and safe."),
    ],
})


# ═══════════════ SSCP — Systems Security Certified Practitioner (7 domaines) ═══════════════
# Outline officiel en vigueur au 15 septembre 2024.
MAPS['sscp1'] = ('SSCP · Security Concepts & Practices', {
    'Foundational Concepts': [
        ('CIA Triad', "Confidentiality, Integrity and Availability — the core security objectives."),
        ('Accountability', "Holding individuals responsible for their actions via identification and logging."),
        ('Non-repudiation', "Preventing a party from denying an action they performed."),
        ('Least Privilege', "Granting only the minimum access required to perform a task."),
        ('Defense in Depth', "Layering multiple controls so no single failure is catastrophic."),
    ],
    'Governance & Ethics': [
        ('ISC2 Code of Ethics', "The professional code of conduct binding ISC2 members."),
        ('Policy', "A high-level statement of management's security intent."),
        ('Security Control', "A safeguard reducing risk (administrative, technical or physical)."),
        ('Separation of Duties', "Dividing critical tasks to prevent fraud and error."),
    ],
})
MAPS['sscp2'] = ('SSCP · Access Controls', {
    'Access Control Models': [
        ('Discretionary Access Control (DAC)', "The resource owner decides who gets access."),
        ('Mandatory Access Control (MAC)', "The system enforces access based on classification labels."),
        ('Role-Based Access Control (RBAC)', "Access is granted according to job role."),
        ('Attribute-Based Access Control (ABAC)', "Access decided dynamically from attributes and policies."),
    ],
    'Identity Management': [
        ('Authentication', "Verifying a claimed identity."),
        ('Single Sign-On (SSO)', "One authentication grants access to multiple systems."),
        ('Federated Identity', "Sharing identity across trust domains (e.g., SAML, OIDC)."),
        ('Provisioning / Deprovisioning', "Creating and removing accounts and their access over their lifecycle."),
    ],
})
MAPS['sscp3'] = ('SSCP · Risk Identification & Analysis', {
    'Risk Management': [
        ('Threat', "Any potential danger that could exploit a vulnerability."),
        ('Vulnerability', "A weakness that a threat can exploit."),
        ('Risk Assessment', "Determining the likelihood and impact of risks."),
        ('Security Assessment', "Testing controls to verify their effectiveness."),
    ],
    'Monitoring & Analysis': [
        ('SIEM', "Security Information and Event Management: correlates and analyses log data."),
        ('Continuous Monitoring', "Ongoing observation of systems to detect issues."),
        ('Log Management', "Collecting, storing and reviewing event logs."),
        ('Vulnerability Scanning', "Automated detection of known weaknesses."),
    ],
})
MAPS['sscp4'] = ('SSCP · Incident Response & Recovery', {
    'Incident Handling': [
        ('Incident Response Plan', "Documented procedures to handle security incidents."),
        ('Containment', "Limiting the spread and impact of an incident."),
        ('Eradication', "Removing the cause of an incident."),
        ('Forensics', "Collecting and preserving evidence for investigation."),
    ],
    'Continuity & Recovery': [
        ('Business Continuity Plan (BCP)', "Keeps critical functions running during disruption."),
        ('Disaster Recovery Plan (DRP)', "Restores IT systems after a major disruption."),
        ('Recovery Time Objective (RTO)', "Maximum acceptable time to restore a function."),
        ('Recovery Point Objective (RPO)', "Maximum acceptable data loss measured in time."),
    ],
})
MAPS['sscp5'] = ('SSCP · Cryptography', {
    'Cryptographic Concepts': [
        ('Symmetric Encryption', "One shared key encrypts and decrypts (e.g., AES)."),
        ('Asymmetric Encryption', "A public/private key pair (e.g., RSA, ECC)."),
        ('Hashing', "A one-way function producing a fixed-length digest (e.g., SHA-256)."),
        ('Digital Signature', "Provides authenticity, integrity and non-repudiation of data."),
    ],
    'Key Management & PKI': [
        ('Public Key Infrastructure (PKI)', "Framework of certificates and authorities managing keys."),
        ('Certificate Authority (CA)', "Trusted entity issuing digital certificates."),
        ('Key Escrow', "Storing keys with a trusted third party for recovery."),
        ('Perfect Forward Secrecy', "Session keys not compromised even if a long-term key is."),
    ],
})
MAPS['sscp6'] = ('SSCP · Network & Communications Security', {
    'Network Fundamentals': [
        ('OSI Model', "Seven-layer model describing network communication."),
        ('TCP/IP Model', "Four-layer protocol suite of the Internet."),
        ('Firewall', "Filters traffic between networks based on rules."),
        ('VPN', "Encrypted tunnel over an untrusted network."),
    ],
    'Network Attacks & Defenses': [
        ('Man-in-the-Middle (MITM)', "Intercepting communication between two parties."),
        ('DDoS', "Overwhelming a service with traffic from many sources."),
        ('IDS / IPS', "Detects (IDS) and blocks (IPS) malicious network activity."),
        ('Network Segmentation', "Dividing a network to contain threats (VLAN, DMZ)."),
    ],
})
MAPS['sscp7'] = ('SSCP · Systems & Application Security', {
    'Malware & Endpoint': [
        ('Malware', "Malicious software (virus, worm, trojan, ransomware)."),
        ('Endpoint Detection & Response (EDR)', "Detects and responds to threats on endpoints."),
        ('Application Whitelisting', "Allowing only approved applications to run."),
        ('Patch Management', "Applying updates to remediate vulnerabilities."),
    ],
    'Secure Environments': [
        ('Virtualization Security', "Protecting hypervisors and virtual machines."),
        ('Cloud Security', "Securing data and workloads in cloud services."),
        ('IoT Security', "Protecting connected devices with limited resources."),
        ('Data Loss Prevention (DLP)', "Preventing unauthorized exfiltration of data."),
    ],
})

# ═══════════════ CCSP — Certified Cloud Security Professional (6 domaines) ═══════════════
# Outline officiel ISC2. Contenu en anglais.
MAPS['ccsp1'] = ('CCSP · Cloud Concepts & Design', {
    'Cloud Fundamentals': [
        ('Cloud Computing', "On-demand delivery of computing resources over the Internet."),
        ('Infrastructure as a Service (IaaS)', "Cloud model providing virtualized compute, storage and network."),
        ('Platform as a Service (PaaS)', "Cloud model providing a platform to build and run applications."),
        ('Software as a Service (SaaS)', "Cloud model delivering ready-to-use applications."),
        ('Shared Responsibility Model', "Security duties split between cloud provider and customer."),
    ],
    'Design Principles': [
        ('Multitenancy', "Multiple customers sharing the same physical infrastructure logically isolated."),
        ('Elasticity', "Scaling resources up or down automatically with demand."),
        ('Cloud Deployment Models', "Public, private, hybrid and community cloud."),
    ],
})
MAPS['ccsp2'] = ('CCSP · Cloud Data Security', {
    'Data Protection': [
        ('Data Lifecycle', "Create, store, use, share, archive, destroy phases of data."),
        ('Encryption at Rest', "Protecting stored data with cryptography."),
        ('Encryption in Transit', "Protecting data moving across networks (TLS)."),
        ('Tokenization', "Replacing sensitive data with non-sensitive tokens."),
        ('Data Loss Prevention (DLP)', "Preventing unauthorized data exfiltration."),
    ],
    'Data Governance': [
        ('Data Classification', "Labeling data by sensitivity."),
        ('Data Retention', "How long data is kept before disposal."),
        ('Information Rights Management (IRM)', "Controls that travel with the data itself."),
    ],
})
MAPS['ccsp3'] = ('CCSP · Platform & Infrastructure Security', {
    'Infrastructure': [
        ('Hypervisor Security', "Protecting the virtualization layer (Type 1 / Type 2)."),
        ('Virtual Machine Security', "Hardening and isolating guest workloads."),
        ('Software-Defined Networking (SDN)', "Programmable, centrally managed network control."),
        ('Micro-segmentation', "Fine-grained isolation of workloads."),
    ],
    'Resilience': [
        ('Business Continuity (BC)', "Keeping cloud services available during disruption."),
        ('Disaster Recovery (DR)', "Restoring cloud services after a major event."),
        ('Redundancy', "Duplicating components to avoid single points of failure."),
    ],
})
MAPS['ccsp4'] = ('CCSP · Cloud Application Security', {
    'Secure Development': [
        ('Secure SDLC', "Embedding security in every development phase."),
        ('DevSecOps', "Integrating security into the DevOps pipeline."),
        ('SAST / DAST', "Static and dynamic application security testing."),
        ('API Security', "Protecting cloud APIs with auth, validation and rate limiting."),
    ],
    'Identity for Apps': [
        ('Identity and Access Management (IAM)', "Managing identities and their access to cloud resources."),
        ('Federation', "Extending identity across trust domains (SAML, OIDC)."),
        ('Secrets Management', "Securely storing API keys, tokens and credentials."),
    ],
})
MAPS['ccsp5'] = ('CCSP · Cloud Security Operations', {
    'Operations': [
        ('Logging and Monitoring', "Collecting and analysing events across cloud services."),
        ('SIEM', "Correlating security events for detection and response."),
        ('Configuration Management', "Maintaining a secure, known cloud configuration baseline."),
        ('Change Management', "Controlled process for modifying cloud systems."),
    ],
    'Continuity': [
        ('Incident Response', "Detecting and handling cloud security incidents."),
        ('Cloud Security Posture Management (CSPM)', "Detecting misconfigurations across cloud accounts."),
        ('Availability Management', "Ensuring services meet their availability targets (SLA)."),
    ],
})
MAPS['ccsp6'] = ('CCSP · Legal, Risk & Compliance', {
    'Legal & Privacy': [
        ('GDPR', "EU regulation protecting personal data."),
        ('Data Sovereignty', "Data is subject to the laws of the country where it resides."),
        ('Privacy', "Protecting personal information handled in the cloud."),
        ('e-Discovery', "Identifying and producing electronic evidence in litigation."),
    ],
    'Risk & Audit': [
        ('Cloud Risk Management', "Identifying and treating risks specific to cloud."),
        ('Service-Level Agreement (SLA)', "Contract defining expected service levels and metrics."),
        ('Audit / SOC 2', "Independent assessment of a provider's controls."),
        ('Vendor Risk Management', "Assessing and managing risk from cloud providers."),
    ],
})


def main():
    branches = {}
    concepts = []
    for key, (label, cats) in MAPS.items():
        branches[key] = label
        for cat, items in cats.items():
            for term, dfn in items:
                concepts.append({'term': term, 'def': dfn, 'cat': cat,
                                 'branch': key, 'tip': label + ' · ' + cat})

    data = {'source': SOURCE, 'branches': branches, 'concepts': concepts}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    print(f"{len(concepts)} concepts ISC2 -> {os.path.relpath(OUT, ROOT)} "
          f"({os.path.getsize(OUT) / 1024:.0f} Ko)")
    for k, (label, _) in MAPS.items():
        n = sum(1 for c in concepts if c['branch'] == k)
        print(f"  {label:34s} {n:>3} concepts")


if __name__ == '__main__':
    main()
