#!/usr/bin/env python3
"""Définitions rédigées à la main pour des concepts CISSP « structure » (sans
définition tirée de la mind map). Appliquées au chargement par terme normalisé.

RÈGLE DE FIABILITÉ : on ne rédige QUE des concepts standards du CBK dont la
définition est certaine et vérifiable. Tout terme douteux, ambigu ou trop
granulaire est laissé SANS définition (il reste une question de catégorie, qui
n'affirme aucune définition — donc aucun risque d'information fausse).

Sortie : www/data/cissp_defs.json = { terme_normalisé : définition }.
Auto-contrôle : on refuse les définitions trop courtes/vagues et on signale les
termes visés qui n'existent pas (ou existent déjà définis) dans le corpus.
"""
import json
import os
import re
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'www/data/cissp_defs.json')


def norm(t):
    t = t.lower()
    t = re.sub(r'\([^)]*\)', '', t)
    t = re.sub(r'[^a-z0-9à-ÿ]+', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


# Définitions certaines (anglais — examen en anglais). Concis et exact.
DEFS = {
    # ── Domaine 1 : Security and Risk Management ──
    'AIC triad': "The core security model of Availability, Integrity and Confidentiality (also CIA).",
    'Preventive': "A control that stops an incident before it occurs (e.g., a lock, encryption).",
    'Detective': "A control that identifies an incident that has occurred (e.g., logs, IDS, CCTV).",
    'Corrective': "A control that restores systems after an incident (e.g., restoring from backup).",
    'Deterrent': "A control that discourages a potential attacker (e.g., warning signs, guards).",
    'Administrative': "A control implemented through policies, procedures and training.",
    'Physical': "A control that protects facilities and hardware (e.g., locks, fences, guards).",
    'Technical': "A control implemented through technology (e.g., firewalls, encryption, access control).",
    'General Data Protection Regulation (GDPR) 2016': "EU regulation (2016/679) protecting the personal data of EU residents.",
    'Data subject': "The identified or identifiable individual to whom personal data relates.",
    'Data controller': "The entity that determines the purposes and means of processing personal data.",
    'Data processor': "The entity that processes personal data on behalf of the controller.",
    'Data Protection Officer (DPO)': "The person responsible for overseeing an organization's data protection strategy and GDPR compliance.",
    'Consent': "A freely given, specific, informed and unambiguous agreement to process personal data.",
    'Right to be forgotten': "The data subject's right to have their personal data erased under certain conditions.",
    'Right to restrict processing': "The data subject's right to limit how their personal data is processed.",
    'Personally identifiable information (PII)': "Any data that can identify a specific individual.",
    'Health Insurance Portability and Accountability Act (HIPAA)': "US law protecting the privacy and security of health information.",
    'Software Piracy': "The unauthorized copying, distribution or use of software.",
    'Digital Millennium Copyright Act (DMCA)': "US law criminalizing circumvention of copyright protection measures.",
    'ISO/IEC 27000 series': "A family of international standards for information security management systems (ISMS).",
    'Zachman Framework': "An enterprise architecture framework organizing artifacts by perspective and question (what/how/where…).",
    'TOGAF': "The Open Group Architecture Framework, a methodology for enterprise architecture.",
    'MODAF': "The UK Ministry of Defence Architecture Framework for military systems.",
    'COBIT 5': "A governance and management framework for enterprise IT by ISACA.",
    'NIST SP 800-53': "A US catalog of security and privacy controls for information systems.",
    'ITIL': "A framework of best practices for IT service management.",
    'Capability Maturity Model Integration (CMMI)': "A model measuring the maturity of an organization's processes across defined levels.",
    'COSO Internal Control—Integrated Framework': "A framework for designing and evaluating internal control over financial reporting.",
    '18 USC 1030': "The US Computer Fraud and Abuse Act, criminalizing unauthorized computer access.",

    # ── Domaine 2 : Asset Security ──
    'Data Owner': "The person accountable for the classification and protection of a data asset.",
    'System Owner': "The person responsible for the operation and security of a specific system.",
    'Data Remanence': "Residual data remaining on media after deletion or erasure.",
    'Degaussing': "Erasing magnetic media by exposing it to a strong magnetic field.",
    'Purging': "Removing data so it cannot be recovered even with laboratory techniques.",
    'Clearing/Overwriting': "Overwriting media so data cannot be recovered by standard means.",
    'Sanitization': "The process of removing data from media so it cannot be reconstructed.",
    'Data Leak Prevention(DLP)': "Technology and controls that detect and block unauthorized exfiltration of data.",
    'Network DLP (NDLP)': "Data loss prevention applied to data in motion on the network.",
    'Endpoint DLP (EDLP)': "Data loss prevention applied on endpoints (workstations, servers).",
    'Electronic Discovery Reference Model (EDRM)': "A framework describing the stages of e-discovery, from identification to presentation.",

    # ── Domaine 3 : Security Architecture and Engineering ──
    'Maintenance Hooks': "Hidden backdoors left by developers to bypass normal access controls.",
    'Certification and accreditation (C&A)': "Certification evaluates a system's controls; accreditation is management's formal approval to operate it.",
    'Random access memory (RAM)': "Volatile memory that loses its contents when power is removed.",
    'Read-Only Memory(ROM)': "Non-volatile memory that retains its contents without power.",
    'Buffer Overflows': "Writing beyond a buffer's bounds to corrupt memory or execute code.",
    'Memory Leaks': "Failure to release allocated memory, gradually exhausting available memory.",
    'Process isolation': "Keeping processes separated so one cannot access another's memory.",
    'Virtual Memory': "Using disk space to extend apparent RAM, paging data in and out.",
    'Virtual Machines': "Software emulation of a computer running an isolated guest operating system.",
    'Simple security rule': "In Bell-LaPadula, a subject cannot read data at a higher classification (no read up).",
    '*-property (star property) rule': "In Bell-LaPadula, a subject cannot write data to a lower classification (no write down).",
    'Simple integrity axiom': "In Biba, a subject cannot read data at a lower integrity level (no read down).",
    '*-integrity axiom': "In Biba, a subject cannot write data to a higher integrity level (no write up).",
    'Clark-Wilson Model': "An integrity model enforcing well-formed transactions and separation of duties.",
    'Noninterference Model': "A model ensuring high-level actions do not affect what low-level subjects observe.",
    'Graham-Denning Model': "A model defining secure creation and deletion of subjects, objects and rights.",
    'Common Criteria（CC)': "An international standard (ISO/IEC 15408) for evaluating security product assurance.",
    'Evaluation Assurance Level (EAL)': "A Common Criteria rating (EAL1–EAL7) of the depth of a product's security evaluation.",
    'Protection profile (PP)': "A Common Criteria document stating security requirements for a category of products.",
    'Target of evaluation (TOE)': "The product or system being evaluated under Common Criteria.",
    'Supervisory Control and Data Acquisition (SCADA)': "Industrial control systems monitoring and controlling physical processes.",
    'Industrial Control Systems(ICS)': "Systems that control industrial and infrastructure processes.",
    'Internet of Things': "Networked everyday devices that collect and exchange data.",
    'Security Perimeter': "The boundary separating the trusted internal environment from untrusted outside.",

    # ── Domaine 4 : Communication and Network Security ──
    'Application Layer': "OSI layer 7: provides network services directly to applications.",
    'Presentation Layer': "OSI layer 6: handles data formatting, encryption and compression.",
    'Session Layer': "OSI layer 5: establishes, manages and terminates sessions.",
    'Transport Layer': "OSI layer 4: provides reliable or unreliable end-to-end delivery (TCP/UDP).",
    'Network Layer': "OSI layer 3: handles logical addressing and routing (IP).",
    'Data Link Layer': "OSI layer 2: frames data and handles MAC addressing on the local link.",
    'Physical Layer': "OSI layer 1: transmits raw bits over the physical medium.",
    'Internet Control Message Protocol(ICMP)': "A network-layer protocol for diagnostics and error messages (e.g., ping).",
    'Simple Network Management Protocol (SNMP)': "A protocol for monitoring and managing network devices.",
    'Post Office Protocol (POP)': "A protocol for retrieving email from a server to a client.",
    'Twisted-Pair Cable': "Copper cabling with paired wires twisted to reduce interference.",
    'Fiber-Optic Cable': "Cabling that carries data as light, offering high speed and immunity to EMI.",
    'Baseband': "Transmission using the entire medium for a single channel.",
    'Broadband': "Transmission dividing the medium into multiple channels.",
    'CSMA/CD': "Carrier-sense multiple access with collision detection, used in classic Ethernet.",
    'CSMA/CA': "Carrier-sense multiple access with collision avoidance, used in Wi-Fi.",
    'IEEE 802.11i or Wi-Fi Protected Access II (WPA2)': "The Wi-Fi security standard using AES-CCMP for strong encryption.",
    'Lightweight Extensible Authentication Protocol (LEAP)': "A Cisco Wi-Fi authentication protocol, now considered insecure.",
    'Fibre Channel over Ethernet (FCoE)': "Encapsulates Fibre Channel storage traffic over Ethernet networks.",
    'Internet Small Computer System Interface (iSCSI)': "Carries SCSI storage commands over IP networks.",

    # ── Domaine 5 : Identity and Access Management ──
    'Core RBAC': "The base role-based access control model: users get permissions via roles.",
    'Hierarchical RBAC': "RBAC where roles inherit permissions from other roles in a hierarchy.",
    'Signature-based': "Intrusion detection matching activity against known attack signatures.",
    'Anomaly-based': "Intrusion detection flagging deviations from a learned baseline of normal behaviour.",
    'Terminal Access Controller Access Control System (TACACS)': "A remote authentication protocol; TACACS+ separates authentication, authorization and accounting.",
    'Diameter': "A modern AAA protocol succeeding RADIUS, used for network access.",
    'Access Control Matrix': "A table mapping subjects to objects and the rights each holds.",
    'Constrained User Interfaces': "Restricting what actions or data a user can access through the interface itself.",
    'Content-Dependent Access Control': "Access decisions based on the content of the data being accessed.",
    'Lightweight Directory Access Protocol (LDAP)': "A protocol for querying and modifying directory services.",
    'One-Time Password': "A password valid for a single login session or transaction.",
    'Side-channel attacks': "Attacks exploiting physical leakage (timing, power, emanations) rather than logic flaws.",
    'Kerberos': "A network authentication protocol using tickets and a trusted Key Distribution Center.",
    'Service Provisioning Markup Language (SPML)': "An XML standard for exchanging user provisioning information.",
    'Security Assertion Markup Language (SAML)': "An XML standard for exchanging authentication and authorization data between parties.",
    'OpenID': "A decentralized standard letting users authenticate via an identity provider.",
    'OAuth': "An open standard for delegated authorization without sharing credentials.",
    'OpenID Connect (OIDC)': "An identity layer on top of OAuth 2.0 providing authentication.",
    'Dictionary Attack': "Cracking passwords by trying words from a precompiled list.",
    'Spoofing at Logon': "Presenting a fake logon screen to capture a user's credentials.",

    # ── Domaine 6 : Security Assessment and Testing ──
    'Internal Audits': "Audits performed by the organization's own staff.",
    'External Audits': "Audits performed by an independent outside party.",
    'Third-Party Audits': "Audits of or by a third party (e.g., a service provider).",
    'Vulnerability Testing': "Identifying weaknesses in systems, often with automated scanners.",
    'War Dialing': "Automatically dialing phone numbers to find modems and access points.",
    'Key Performance Indicators': "Metrics measuring how well security objectives are being met.",
    'Real User Monitoring': "Capturing real users' interactions to measure actual system behaviour.",
    'Checklist Test': "A BCP test where teams review the plan against a checklist, without execution.",

    # ── Domaine 7 : Security Operations ──
    'Mean Time Between Failures': "The expected average time between failures of a device (reliability metric).",
    'Single Points of Failure': "A component whose failure alone would stop the whole system.",
    'Redundant Array of Independent Tapes': "RAIT: striping data across multiple tape drives for performance and redundancy.",
    'Electronic vaulting': "Backing up data by transmitting it electronically to a remote site.",
    'Business Process Recovery': "Restoring the business processes disrupted by an incident.",
    'Trusted Recovery': "Ensuring a system restarts securely after a failure without weakening controls.",
    'Computer Forensics and Proper Collection of Evidence': "The disciplined collection, preservation and analysis of digital evidence.",
    'Mechanical Locks': "Locks operated purely by physical mechanisms (wards or tumblers).",
    'Facility Access Control': "Controls restricting physical entry to a facility.",
    'Vulnerability Management': "The ongoing process of identifying, prioritizing and remediating vulnerabilities.",
    'Centralized Patch Management': "Deploying and tracking patches from a single central system.",
    'Asset Inventory': "A maintained record of an organization's hardware and software assets.",
    'Change Control Process': "A formal process to request, review, approve and document system changes.",
    'Emergency Management': "Planning and coordinating the response to emergencies threatening people or operations.",
}

# Termes trop granulaires ou ambigus : volontairement LAISSÉS sans définition
# (restent des questions de catégorie ; documenté pour la transparence).


def main():
    present = {}
    for f in glob.glob(os.path.join(ROOT, 'www/data/*concepts*.json')):
        for c in json.load(open(f, encoding='utf-8'))['concepts']:
            present.setdefault(norm(c['term']), c.get('def') is not None)

    out = {}
    absent, already, weak = [], [], []
    for term, dfn in DEFS.items():
        key = norm(term)
        # auto-contrôle qualité de la définition
        if len(dfn) < 30 or dfn.count(' ') < 4:
            weak.append(term); continue
        if key not in present:
            absent.append(term); continue
        if present[key]:
            already.append(term)      # déjà défini ailleurs : inutile de doublonner
        out[key] = dfn

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"{len(out)} définitions rédigées -> {os.path.relpath(OUT, ROOT)}")
    if weak:
        print(f"  ⚠ {len(weak)} définitions trop faibles (rejetées) : {', '.join(weak)}")
    if absent:
        print(f"  ⚠ {len(absent)} termes introuvables dans le corpus : {', '.join(absent)}")
    if already:
        print(f"  ℹ {len(already)} déjà définis ailleurs (redondants mais inoffensifs)")


if __name__ == '__main__':
    main()
