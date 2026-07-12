#!/usr/bin/env python3
"""CEH — Certified Ethical Hacker (EC-Council, CEH v13) : les 20 modules officiels.

Contenu en anglais (examen en anglais). Un thème unique `ceh1`, catégories = les
quatre groupes du framework CEH v13, concepts = les 20 modules + techniques clés.
Sortie : www/data/ceh_concepts.json. Groupe « CEH » dans le sélecteur.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'www/data/ceh_concepts.json')
SOURCE = 'EC-Council CEH v13 — 20 modules officiels (à re-vérifier sur eccouncil.org)'

# Un seul thème ; catégories = groupes du framework CEH v13.
CATS = {
    'Foundations (Modules 1-5)': [
        ('Introduction to Ethical Hacking', "Fundamentals of ethical hacking, the cyber kill chain and attack phases."),
        ('Footprinting and Reconnaissance', "Gathering information about a target using open sources (OSINT)."),
        ('Scanning Networks', "Discovering live hosts, ports and services on a network."),
        ('Enumeration', "Extracting usernames, shares and services from a target."),
        ('Vulnerability Analysis', "Identifying and assessing weaknesses in systems and applications."),
    ],
    'System Attacks (Modules 6-10)': [
        ('System Hacking', "Gaining access, escalating privileges and maintaining access to a system."),
        ('Malware Threats', "Viruses, worms, trojans, ransomware and their analysis."),
        ('Sniffing', "Capturing and analysing network traffic to steal data."),
        ('Social Engineering', "Manipulating people to divulge information or grant access."),
        ('Denial-of-Service', "Overwhelming a target to make a service unavailable (DoS/DDoS)."),
    ],
    'Network & Web Attacks (Modules 11-15)': [
        ('Session Hijacking', "Taking over a valid user session to gain unauthorized access."),
        ('Evading IDS, Firewalls and Honeypots', "Techniques to bypass detection and prevention systems."),
        ('Hacking Web Servers', "Exploiting web server misconfigurations and vulnerabilities."),
        ('Hacking Web Applications', "Attacking web apps (OWASP Top 10, auth flaws, injection)."),
        ('SQL Injection', "Injecting malicious SQL to manipulate a database."),
    ],
    'Emerging Tech (Modules 16-20)': [
        ('Hacking Wireless Networks', "Attacking Wi-Fi encryption and access points."),
        ('Hacking Mobile Platforms', "Exploiting Android and iOS devices and apps."),
        ('IoT and OT Hacking', "Attacking connected devices and operational technology."),
        ('Cloud Computing', "Cloud attack techniques and container/serverless security."),
        ('Cryptography', "Encryption, hashing, PKI and cryptographic attacks."),
    ],
    'Phases & concepts clés': [
        ('Reconnaissance', "First hacking phase: gathering information about the target."),
        ('Scanning', "Second phase: probing the target for live hosts and open ports."),
        ('Gaining Access', "Third phase: exploiting a vulnerability to enter the system."),
        ('Maintaining Access', "Fourth phase: keeping persistent access (backdoors, rootkits)."),
        ('Clearing Tracks', "Fifth phase: erasing evidence of the intrusion."),
        ('Cyber Kill Chain', "Model describing the stages of a cyber attack."),
        ('Footprinting', "Collecting information to build a profile of the target."),
        ('Privilege Escalation', "Gaining higher rights than initially granted."),
    ],
    'Reconnaissance & scanning': [
        ('OSINT', "Open-Source Intelligence: gathering data from public sources."),
        ('Active Reconnaissance', "Directly interacting with the target to gather data."),
        ('Passive Reconnaissance', "Gathering data without touching the target."),
        ('Nmap', "Popular tool for network discovery and port scanning."),
        ('Port Scanning', "Probing a host to find open ports and services."),
        ('Banner Grabbing', "Reading service banners to identify software and versions."),
        ('SYN Scan', "Stealthy half-open TCP scan that avoids full connections."),
        ('Google Dorking', "Using advanced search operators to find exposed data."),
    ],
    'Access & post-exploitation': [
        ('Password Cracking', "Recovering passwords by brute force, dictionary or rainbow tables."),
        ('Rainbow Table', "Precomputed hash lookup table to crack passwords fast."),
        ('Keylogger', "Records keystrokes to steal credentials."),
        ('Rootkit', "Stealthy malware hiding its presence with deep system access."),
        ('Backdoor', "Hidden access mechanism bypassing normal authentication."),
        ('Pass-the-Hash', "Authenticating with a stolen password hash instead of the password."),
        ('Steganography', "Hiding data inside other files (images, audio)."),
        ('Covering Tracks', "Deleting logs and artifacts to hide intrusion."),
    ],
    'Malware & sniffing': [
        ('Trojan', "Malware disguised as legitimate software."),
        ('Worm', "Self-replicating malware spreading without user action."),
        ('Ransomware', "Malware encrypting data and demanding a ransom."),
        ('Botnet', "Network of compromised machines controlled remotely."),
        ('ARP Spoofing', "Poisoning ARP tables to intercept LAN traffic."),
        ('MAC Flooding', "Overwhelming a switch to force it to broadcast traffic."),
        ('DNS Poisoning', "Corrupting DNS responses to redirect victims."),
    ],
    'Web & network attacks': [
        ('SQL Injection', "Injecting malicious SQL to manipulate a database."),
        ('Cross-Site Scripting (XSS)', "Injecting scripts into pages viewed by other users."),
        ('Cross-Site Request Forgery (CSRF)', "Forcing a browser to send unwanted authenticated requests."),
        ('Directory Traversal', "Accessing files outside the web root via crafted paths."),
        ('Command Injection', "Executing arbitrary OS commands through vulnerable input."),
        ('Session Fixation', "Forcing a known session ID onto a victim to hijack it."),
        ('Honeypot', "A decoy system used to detect and study attackers."),
        ('Firewall Evasion', "Techniques to bypass firewall filtering (fragmentation, tunneling)."),
    ],
    'Wireless, mobile & crypto': [
        ('WEP', "Obsolete, insecure Wi-Fi encryption standard."),
        ('WPA3', "Latest, strongest Wi-Fi security protocol."),
        ('Evil Twin', "Rogue access point impersonating a legitimate one."),
        ('Deauthentication Attack', "Forcing clients off Wi-Fi to capture handshakes."),
        ('Jailbreaking / Rooting', "Removing OS restrictions on mobile devices."),
        ('Symmetric Encryption', "Same key encrypts and decrypts (e.g., AES)."),
        ('Asymmetric Encryption', "Public/private key pair (e.g., RSA)."),
        ('Hashing', "One-way function producing a fixed-length digest."),
        ('Man-in-the-Middle (MITM)', "Intercepting communication between two parties."),
    ],
}


def main():
    branches = {'ceh1': 'CEH v13'}
    concepts = []
    seen = set()
    for cat, items in CATS.items():
        for term, dfn in items:
            low = term.lower()
            if low in seen:   # un terme (ex. SQL Injection) peut figurer dans 2 rubriques
                continue
            seen.add(low)
            concepts.append({'term': term, 'def': dfn, 'cat': cat,
                             'branch': 'ceh1', 'tip': 'CEH v13 · ' + cat})

    data = {'source': SOURCE, 'branches': branches, 'concepts': concepts}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"{len(concepts)} concepts CEH -> {os.path.relpath(OUT, ROOT)} "
          f"({os.path.getsize(OUT) / 1024:.0f} Ko)")


if __name__ == '__main__':
    main()
