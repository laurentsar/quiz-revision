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
}


def main():
    branches = {'ceh1': 'CEH v13'}
    concepts = []
    for cat, items in CATS.items():
        for term, dfn in items:
            concepts.append({'term': term, 'def': dfn, 'cat': cat,
                             'branch': 'ceh1', 'tip': 'CEH v13 · ' + cat})

    data = {'source': SOURCE, 'branches': branches, 'concepts': concepts}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"{len(concepts)} concepts CEH -> {os.path.relpath(OUT, ROOT)} "
          f"({os.path.getsize(OUT) / 1024:.0f} Ko)")


if __name__ == '__main__':
    main()
