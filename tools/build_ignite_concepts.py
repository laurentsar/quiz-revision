#!/usr/bin/env python3
"""Concepts révisables issus des mind maps Ignite Technologies (github.com/Ignitetechnologies/Mindmap).

Les images ne sont PAS embarquées (repo source sans licence, repo app public) : on
transcrit leur arborescence en concepts français, enrichis de définitions rédigées.
Même moteur que le CISSP : un concept avec `def` alimente tous les types de questions ;
sans `def`, seule la question de catégorie (« à quelle rubrique appartient X ? »).

Sortie : www/data/ignite_concepts.json — fusionnée avec les autres bases au démarrage.
Les 11 thèmes sont préfixés `ig_` : l'app les regroupe sous « Réf. cyber ».
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'www/data/ignite_concepts.json')
SOURCE = 'Mind maps Ignite Technologies (github.com/Ignitetechnologies/Mindmap) — transcrites et traduites, images non incluses'

# Chaque thème : clé -> (libellé, { catégorie : [ (terme, définition|None), ... ] }).
MAPS = {}

# ─────────────────────────── NIST Cybersecurity Framework ───────────────────────────
MAPS['ig_nist'] = ('NIST CSF', {
    'Identify (Identifier)': [
        ('Asset Management', "Recenser et gérer les actifs (matériels, logiciels, données) selon leur importance pour l'organisation."),
        ('Business Environment', "Comprendre la mission, les parties prenantes et la place de l'organisation dans la chaîne de valeur."),
        ('Governance', "Politiques, procédures et responsabilités qui pilotent la gestion du risque cyber."),
        ('Risk Assessment', "Évaluer le risque pesant sur les opérations, les actifs et les personnes."),
        ('Risk Management Strategy', "Définir priorités, contraintes et tolérance au risque de l'organisation."),
        ('Supply Chain Risk Management', "Gérer le risque lié aux fournisseurs et à la chaîne d'approvisionnement."),
    ],
    'Protect (Protéger)': [
        ('Identity Management and Access Control', "Limiter l'accès aux actifs aux seuls utilisateurs, processus et appareils autorisés."),
        ('Awareness and Training', "Sensibiliser et former le personnel à ses responsabilités de sécurité."),
        ('Data Security', "Protéger la confidentialité, l'intégrité et la disponibilité des données."),
        ('Information Protection Processes and Procedures', "Maintenir des politiques et procédures de protection des systèmes d'information."),
        ('Maintenance', "Entretenir et réparer les composants selon des procédures maîtrisées."),
        ('Protective Technology', "Solutions techniques assurant la sécurité et la résilience des systèmes."),
    ],
    'Detect (Détecter)': [
        ('Anomalies and Events', "Détecter les activités anormales et en comprendre l'impact potentiel."),
        ('Security Continuous Monitoring', "Surveiller en continu les systèmes pour repérer les événements de sécurité."),
        ('Detection Processes', "Maintenir et tester les processus de détection des incidents."),
    ],
    'Respond (Répondre)': [
        ('Response Planning', "Exécuter et maintenir les processus de réponse aux incidents détectés."),
        ('Communications', "Coordonner la réponse avec les parties prenantes internes et externes."),
        ('Analysis', "Analyser l'incident pour assurer une réponse efficace et étayer la reprise."),
        ('Mitigation', "Contenir l'incident et en atténuer les effets."),
        ('Improvements', "Tirer les leçons des incidents pour renforcer la réponse."),
    ],
    'Recover (Rétablir)': [
        ('Recovery Planning', "Exécuter les processus de reprise pour restaurer les services affectés."),
        ('Improvements', "Améliorer la reprise à partir du retour d'expérience."),
        ('Communications', "Coordonner la reprise en interne et avec l'extérieur (clients, partenaires)."),
    ],
})

# ─────────────────────────── RGPD (GDPR, en français) ───────────────────────────
MAPS['ig_gdpr'] = ('RGPD', {
    'Présentation & champ': [
        ('Entrée en vigueur', "RGPD applicable depuis mai 2018 (Règlement UE 2016/679)."),
        ('Champ territorial', "S'applique aux organismes de l'UE/EEE et, par extraterritorialité, aux entreprises hors UE ciblant des résidents européens."),
        ('Directive remplacée', "Remplace la directive 95/46/CE sur la protection des données."),
        ('Autorités de contrôle', "Appliqué par les autorités nationales (la CNIL en France)."),
    ],
    '7 principes (Art. 5)': [
        ('Licéité, loyauté, transparence', "Traiter les données de façon licite, loyale et transparente pour la personne."),
        ('Limitation des finalités', "Collecter pour des finalités déterminées, explicites et légitimes."),
        ('Minimisation des données', "Ne collecter que les données adéquates, pertinentes et strictement nécessaires."),
        ('Exactitude', "Maintenir les données exactes et à jour."),
        ('Limitation de conservation', "Ne conserver les données que le temps nécessaire aux finalités."),
        ('Intégrité et confidentialité', "Garantir la sécurité des données par des mesures appropriées."),
        ('Responsabilité (accountability)', "Le responsable doit pouvoir démontrer sa conformité."),
    ],
    'Bases légales (Art. 6)': [
        ('Consentement', "La personne a consenti au traitement de ses données."),
        ('Nécessité contractuelle', "Traitement nécessaire à l'exécution d'un contrat."),
        ('Obligation légale', "Traitement imposé par une obligation légale."),
        ('Intérêts vitaux', "Traitement nécessaire à la sauvegarde de la vie d'une personne."),
        ('Mission d\'intérêt public', "Traitement relevant d'une mission d'intérêt public."),
        ('Intérêts légitimes', "Intérêt légitime du responsable, sauf atteinte aux droits de la personne."),
    ],
    'Droits des personnes': [
        ('Droit d\'accès (Art. 15)', "Obtenir la confirmation et une copie des données traitées."),
        ('Droit de rectification (Art. 16)', "Faire corriger des données inexactes ou incomplètes."),
        ('Droit à l\'effacement (Art. 17)', "« Droit à l'oubli » : faire supprimer ses données sous conditions."),
        ('Droit à la limitation (Art. 18)', "Faire geler temporairement un traitement contesté."),
        ('Droit à la portabilité (Art. 20)', "Récupérer ses données dans un format structuré et réutilisable."),
        ('Droit d\'opposition (Art. 21)', "S'opposer à un traitement, notamment à des fins de prospection."),
        ('Décision automatisée (Art. 22)', "Ne pas faire l'objet d'une décision fondée uniquement sur un traitement automatisé."),
    ],
    'Rôles clés': [
        ('Responsable de traitement', "Détermine les finalités et les moyens du traitement ; porte la responsabilité principale."),
        ('Sous-traitant', "Traite les données pour le compte du responsable, encadré par un contrat (DPA)."),
        ('Délégué à la protection (DPO)', "Conseille et contrôle la conformité ; obligatoire pour le secteur public et les traitements à grande échelle."),
        ('Personne concernée', "L'individu dont les données personnelles sont traitées."),
        ('Autorité de contrôle', "Autorité nationale (CNIL) chargée de veiller à l'application du RGPD."),
    ],
    'Exigences de consentement': [
        ('Libre', "Donné sans contrainte ni conséquence négative en cas de refus."),
        ('Spécifique', "Rattaché à une finalité déterminée."),
        ('Éclairé', "La personne est informée avant de consentir."),
        ('Univoque', "Résulte d'un acte positif clair (pas de cases pré-cochées)."),
        ('Retirable', "Peut être retiré à tout moment, aussi facilement que donné."),
    ],
    'Obligations des organismes': [
        ('Privacy by design & by default (Art. 25)', "Intégrer la protection des données dès la conception et par défaut."),
        ('Registre des traitements (Art. 30)', "Tenir un registre des activités de traitement (ROPA)."),
        ('Analyse d\'impact — AIPD (Art. 35)', "Évaluer l'impact sur la vie privée des traitements à risque élevé."),
        ('Contrat de sous-traitance (Art. 28)', "Encadrer la sous-traitance par un accord écrit (DPA)."),
        ('Nomination d\'un DPO (Art. 37)', "Désigner un délégué lorsque la loi l'exige."),
        ('Information / transparence (Art. 13-14)', "Fournir une information claire sur le traitement des données."),
        ('Mesures de sécurité (Art. 32)', "Mettre en œuvre des mesures techniques et organisationnelles adaptées au risque."),
    ],
    'Notification de violation': [
        ('Notifier l\'autorité sous 72 h (Art. 33)', "Signaler une violation à l'autorité de contrôle dans les 72 heures."),
        ('Informer les personnes (Art. 34)', "Avertir les personnes concernées sans délai en cas de risque élevé."),
        ('Documenter les violations', "Consigner toutes les violations en interne, même non notifiées."),
    ],
    'Sanctions & transferts': [
        ('Amende palier 1', "Jusqu'à 10 M€ ou 2 % du chiffre d'affaires mondial."),
        ('Amende palier 2', "Jusqu'à 20 M€ ou 4 % du chiffre d'affaires mondial."),
        ('Droit à réparation (Art. 82)', "Toute personne ayant subi un dommage peut obtenir réparation."),
        ('Guichet unique', "Une autorité chef de file coordonne pour les traitements transfrontaliers."),
        ('Décision d\'adéquation', "Transfert autorisé vers un pays offrant un niveau de protection adéquat."),
        ('Clauses contractuelles types (CCT)', "Clauses standard encadrant les transferts hors UE."),
        ('Règles d\'entreprise contraignantes (BCR)', "Règles internes approuvées encadrant les transferts intra-groupe."),
    ],
})

# ─────────────────────────── HIPAA ───────────────────────────
MAPS['ig_hipaa'] = ('HIPAA', {
    'Privacy Rule': [
        ('Protected Health Information (PHI)', "Toute information de santé identifiante protégée par HIPAA."),
        ('Minimum Necessary Standard', "N'utiliser ou ne divulguer que le minimum de PHI nécessaire."),
        ('Patient Rights', "Droits d'accès, de rectification et de restriction du patient sur ses données."),
        ('Notice of Privacy Practices (NPP)', "Avis informant le patient de l'usage de ses données de santé."),
    ],
    'Security Rule': [
        ('Administrative Safeguards', "Mesures organisationnelles protégeant les PHI électroniques (ePHI)."),
        ('Physical Safeguards', "Protections physiques des systèmes et des locaux hébergeant les ePHI."),
        ('Technical Safeguards', "Contrôles techniques (chiffrement, contrôle d'accès) sur les ePHI."),
        ('Risk Analysis & Management', "Analyser et gérer les risques pesant sur les ePHI."),
    ],
    'Autres règles': [
        ('Transactions & Code Sets Rule', "Standardise les transactions électroniques de santé (EDI, ICD-10, CPT)."),
        ('Identifiers Rule', "Identifiants standard : NPI (soignant), EIN (employeur), HPID (assureur)."),
        ('Enforcement Rule', "Sanctions civiles (100 $–50 000 $/violation) et pénales, enquêtes de l'OCR."),
        ('Breach Notification Rule', "Notifier les personnes sous 60 jours ; HHS/médias si 500+ concernés."),
    ],
    'Entités & identifiants': [
        ('Covered Entities', "Plans de santé, soignants et chambres de compensation soumis à HIPAA."),
        ('Business Associate Agreement (BAA)', "Contrat encadrant un sous-traitant manipulant des PHI."),
        ('18 PHI Identifiers', "Les 18 identifiants (noms, dates, SSN, biométrie…) rendant une donnée identifiante."),
    ],
})

# ─────────────────────────── Codes HTTP ───────────────────────────
MAPS['ig_http'] = ('Codes HTTP', {
    '1xx Informational': [
        ('100 Continue', "Le client peut poursuivre l'envoi de la requête."),
        ('101 Switching Protocols', "Le serveur accepte de changer de protocole."),
        ('102 Processing', "Requête reçue, traitement en cours (WebDAV)."),
    ],
    '2xx Successful': [
        ('200 OK', "Requête réussie."),
        ('201 Created', "Ressource créée avec succès."),
        ('202 Accepted', "Requête acceptée mais traitement non terminé."),
        ('204 No Content', "Succès sans corps de réponse."),
        ('206 Partial Content', "Contenu partiel renvoyé (requête Range)."),
    ],
    '3xx Redirection': [
        ('301 Moved Permanently', "Ressource déplacée de façon permanente."),
        ('302 Found', "Redirection temporaire."),
        ('304 Not Modified', "Ressource inchangée, utiliser le cache."),
        ('307 Temporary Redirect', "Redirection temporaire en conservant la méthode."),
        ('308 Permanent Redirect', "Redirection permanente en conservant la méthode."),
    ],
    '4xx Client Error': [
        ('400 Bad Request', "Requête mal formée."),
        ('401 Unauthorized', "Authentification requise ou échouée."),
        ('403 Forbidden', "Accès refusé malgré une authentification valide."),
        ('404 Not Found', "Ressource introuvable."),
        ('405 Method Not Allowed', "Méthode HTTP non autorisée pour cette ressource."),
        ('408 Request Timeout', "Le serveur a trop attendu la requête."),
        ('409 Conflict', "Conflit avec l'état actuel de la ressource."),
        ('418 I\'m a teapot', "Blague RFC 2324 : « je suis une théière »."),
        ('429 Too Many Requests', "Trop de requêtes (limitation de débit)."),
    ],
    '5xx Server Error': [
        ('500 Internal Server Error', "Erreur générique côté serveur."),
        ('501 Not Implemented', "Fonctionnalité non supportée par le serveur."),
        ('502 Bad Gateway', "Réponse invalide reçue d'un serveur amont."),
        ('503 Service Unavailable', "Service indisponible (surcharge ou maintenance)."),
        ('504 Gateway Timeout', "Délai dépassé en attendant un serveur amont."),
        ('511 Network Authentication Required', "Authentification réseau nécessaire (portail captif)."),
    ],
})

# ─────────────────────────── Ingénierie sociale ───────────────────────────
MAPS['ig_socialeng'] = ('Ingénierie sociale', {
    'Phishing': [
        ('Spear Phishing', "Hameçonnage ciblé sur une personne ou organisation précise."),
        ('Vishing', "Hameçonnage par téléphone (voice phishing)."),
        ('Smishing', "Hameçonnage par SMS."),
        ('Clone Phishing', "Copie d'un email légitime dont les liens sont remplacés par des liens malveillants."),
        ('Watering Hole Attack', "Compromettre un site fréquenté par la cible pour l'infecter."),
        ('Business Email Compromise (BEC)', "Usurpation d'un dirigeant pour ordonner un virement frauduleux."),
    ],
    'Pretexting': [
        ('Tech Support Scam', "Faux support technique soutirant accès ou paiement."),
        ('CEO Fraud Scam', "Usurpation d'un dirigeant pour obtenir un virement ou des données."),
        ('Job Scam', "Fausse offre d'emploi pour collecter données ou argent."),
        ('Lottery Scam', "Faux gain de loterie exigeant des frais préalables."),
    ],
    'Baiting': [
        ('USB Drop Attack', "Clé USB piégée abandonnée pour être branchée par la victime."),
        ('Fake WiFi Hotspot', "Point d'accès WiFi factice pour intercepter le trafic."),
        ('Evil Twin Attack', "Faux point d'accès imitant un réseau légitime."),
        ('QR Code Scam', "QR code menant vers un site ou un paiement frauduleux."),
    ],
    'Quid Pro Quo': [
        ('Conference Scam', "Fausse invitation à une conférence pour soutirer paiement ou données."),
        ('Fake Software Scam', "Faux logiciel « gratuit » en échange d'informations."),
        ('IT Support Scam', "Faux service informatique offrant de l'aide contre un accès."),
    ],
    'Tailgating & physique': [
        ('Piggybacking / Tailgating', "Entrer dans un local sécurisé en suivant une personne autorisée."),
        ('Dumpster Diving', "Fouiller les poubelles pour récupérer des informations sensibles."),
        ('Shoulder Surfing', "Observer par-dessus l'épaule pour capter mots de passe ou codes."),
        ('Eavesdropping', "Écoute clandestine de conversations ou de communications."),
        ('Credit Card Skimming', "Copie des données d'une carte via un lecteur piégé."),
    ],
})

# ─────────────────────────── MITRE ATT&CK (14 tactiques) ───────────────────────────
MAPS['ig_mitre'] = ('MITRE ATT&CK', {
    'Tactiques Enterprise': [
        ('Reconnaissance (TA0043)', "Collecter des informations pour préparer une future attaque."),
        ('Resource Development (TA0042)', "Mettre en place les ressources (infrastructure, comptes) servant l'attaque."),
        ('Initial Access (TA0001)', "Obtenir un premier pied dans le réseau cible."),
        ('Execution (TA0002)', "Exécuter du code malveillant sur un système."),
        ('Persistence (TA0003)', "Maintenir l'accès malgré redémarrages et changements d'identifiants."),
        ('Privilege Escalation (TA0004)', "Obtenir des privilèges plus élevés sur le système."),
        ('Defense Evasion (TA0005)', "Échapper à la détection des défenses."),
        ('Credential Access (TA0006)', "Voler des identifiants (noms de compte, mots de passe)."),
        ('Discovery (TA0007)', "Explorer l'environnement pour le comprendre."),
        ('Lateral Movement (TA0008)', "Se déplacer d'un système à l'autre dans le réseau."),
        ('Collection (TA0009)', "Rassembler les données d'intérêt pour l'objectif."),
        ('Command and Control (TA0011)', "Communiquer avec les systèmes compromis pour les piloter."),
        ('Exfiltration (TA0010)', "Extraire les données volées hors du réseau."),
        ('Impact (TA0040)', "Manipuler, interrompre ou détruire systèmes et données."),
    ],
})

# ─────────────────────────── Blue Teaming (défense) ───────────────────────────
MAPS['ig_blueteam'] = ('Blue Team', {
    'Blue Team Operations': [
        ('Threat Hunting', "Recherche proactive de menaces non détectées dans le SI."),
        ('Detection Engineering', "Conception et maintenance des règles de détection."),
        ('Attack Simulation', "Rejouer des attaques pour tester les défenses."),
        ('Security Automation', "Automatiser les tâches de sécurité répétitives."),
    ],
    'Security Monitoring': [
        ('Security Operations Center (SOC)', "Équipe supervisant la sécurité en continu."),
        ('Log Monitoring', "Surveillance des journaux pour repérer des anomalies."),
        ('Endpoint Monitoring', "Surveillance des postes et serveurs."),
        ('Network Monitoring', "Surveillance du trafic réseau."),
    ],
    'Threat Detection': [
        ('SIEM Analysis', "Corrélation des événements de sécurité via un SIEM."),
        ('Signature Detection', "Détection par signatures connues de menaces."),
        ('Behavior Analysis', "Détection fondée sur les comportements."),
        ('Anomaly Detection', "Détection des écarts par rapport à la normale."),
        ('MITRE ATT&CK Mapping', "Cartographie des détections sur le référentiel ATT&CK."),
    ],
    'Incident Response': [
        ('Incident Identification', "Repérer et qualifier un incident de sécurité."),
        ('Containment', "Contenir l'incident pour limiter sa propagation."),
        ('Eradication', "Éliminer la cause de l'incident."),
        ('Recovery', "Restaurer les systèmes et services."),
        ('Post-Incident Review', "Retour d'expérience après incident."),
    ],
    'Threat Intelligence': [
        ('Indicators of Compromise (IOC)', "Traces techniques révélant une compromission."),
        ('Indicators of Attack (IOA)', "Signes d'une attaque en cours, orientés comportement."),
        ('Adversary Tracking', "Suivi des groupes d'attaquants."),
        ('Malware Analysis', "Analyse du code malveillant."),
    ],
    'Endpoint & réseau': [
        ('Endpoint Detection and Response (EDR)', "Détection et réponse au niveau des postes."),
        ('Host Intrusion Detection', "Détection d'intrusion sur un hôte (HIDS)."),
        ('Intrusion Detection System (IDS)', "Détecte les intrusions réseau."),
        ('Intrusion Prevention System (IPS)', "Détecte et bloque les intrusions réseau."),
        ('Firewall Monitoring', "Surveillance des pare-feux."),
    ],
    'Log & vulnérabilités': [
        ('Log Correlation', "Rapprocher des journaux de sources différentes."),
        ('Centralized Logging', "Centraliser les journaux pour l'analyse."),
        ('Vulnerability Scanning', "Rechercher automatiquement les failles."),
        ('Configuration Hardening', "Durcir la configuration des systèmes."),
        ('Patch Management', "Gérer le déploiement des correctifs."),
    ],
})

# ─────────────────────────── Technologies cybersécurité ───────────────────────────
MAPS['ig_cybertech'] = ('Techno cyber', {
    'Network Security': [
        ('Next-Gen Firewall / WAF', "Pare-feu applicatif de nouvelle génération."),
        ('IDS/IPS', "Détection/prévention d'intrusion réseau."),
        ('Network Access Control (NAC)', "Contrôle des équipements admis sur le réseau."),
        ('Secure Web Gateway (SWG)', "Passerelle filtrant le trafic web sortant."),
        ('Network Segmentation', "Cloisonner le réseau pour limiter la propagation."),
    ],
    'Endpoint Security': [
        ('Antivirus / Anti-malware', "Détection des logiciels malveillants sur les postes."),
        ('Endpoint Detection & Response (EDR)', "Détection et réponse avancées sur les postes."),
        ('Host-Based IPS (HIPS)', "Prévention d'intrusion au niveau de l'hôte."),
        ('Application Whitelisting', "N'autoriser que les applications approuvées."),
    ],
    'Cloud Security': [
        ('CASB', "Cloud Access Security Broker : contrôle l'usage des services cloud."),
        ('Cloud Workload Protection (CWPP)', "Protection des charges de travail cloud."),
        ('Cloud Security Posture Management (CSPM)', "Surveillance des mauvaises configurations cloud."),
        ('Zero Trust Network Access (ZTNA)', "Accès sans confiance implicite, vérifié en continu."),
    ],
    'Identity & Access (IAM)': [
        ('Multi-Factor Authentication (MFA)', "Authentification à plusieurs facteurs."),
        ('Privileged Access Management (PAM)', "Gestion des comptes à privilèges."),
        ('Single Sign-On (SSO)', "Authentification unique pour plusieurs services."),
        ('Identity Governance (IGA)', "Gouvernance des identités et des accès."),
        ('Directory Services', "Annuaires (Active Directory, LDAP)."),
    ],
    'Threat Intel & Monitoring': [
        ('SIEM', "Gestion des informations et événements de sécurité."),
        ('SOAR', "Orchestration, automatisation et réponse de sécurité."),
        ('Threat Intelligence Platform (TIP)', "Plateforme de renseignement sur les menaces."),
        ('UEBA', "Analyse comportementale des utilisateurs et entités."),
    ],
    'Data & App Security': [
        ('Data Loss Prevention (DLP)', "Prévention de la fuite de données."),
        ('Tokenization', "Remplacer une donnée sensible par un jeton non signifiant."),
        ('SAST / DAST', "Tests de sécurité applicative statiques / dynamiques."),
        ('Runtime App Self-Protection (RASP)', "Protection applicative à l'exécution."),
        ('Software Composition Analysis (SCA)', "Analyse des dépendances open source."),
    ],
    'Offensive & GRC': [
        ('Penetration Testing', "Test d'intrusion pour évaluer la sécurité."),
        ('Breach & Attack Simulation (BAS)', "Simulation continue d'attaques."),
        ('GRC Platforms', "Gouvernance, risque et conformité."),
        ('Disaster Recovery as a Service (DRaaS)', "Reprise d'activité externalisée."),
        ('Immutable Backups', "Sauvegardes non modifiables, anti-rançongiciel."),
    ],
})

# ─────────────────────────── Security 360° ───────────────────────────
MAPS['ig_sec360'] = ('Sécurité 360°', {
    'Advance Threat Protection': [
        ('Botnet Protection', "Protection contre les réseaux de machines zombies."),
        ('Sandboxing and Emulation', "Exécution isolée pour analyser un fichier suspect."),
        ('Network Forensics', "Investigation à partir du trafic réseau."),
        ('Application Whitelisting', "N'autoriser que les applications approuvées."),
    ],
    'Network Security': [
        ('Firewall Management', "Gestion des règles de pare-feu."),
        ('Network Access Control', "Contrôle des accès au réseau."),
        ('Unified Threat Management', "Boîtier regroupant plusieurs fonctions de sécurité."),
        ('Intrusion Detection/Prevention Systems', "Détection/prévention d'intrusion réseau."),
    ],
    'Data Security': [
        ('Data Encryption', "Chiffrement des données."),
        ('Data Leakage Prevention', "Prévention de la fuite de données (DLP)."),
    ],
    'Infrastructure Security': [
        ('DNS Security', "Sécurisation de la résolution de noms."),
        ('Mail Security', "Filtrage et protection de la messagerie."),
        ('SIEM', "Gestion des informations et événements de sécurité."),
        ('Zero Day Vulnerability Tracking', "Suivi des failles inconnues (0-day)."),
    ],
    'Mobile Security': [
        ('OWASP Mobile Top 10', "Principaux risques de sécurité des applications mobiles."),
        ('Rogue Access Point Detection', "Détection de points d'accès pirates."),
        ('Mobile Penetration Testing', "Test d'intrusion mobile."),
    ],
    'Application Security': [
        ('OWASP Top 10', "Principaux risques de sécurité des applications web."),
        ('Web Application Firewall', "Pare-feu applicatif web (WAF)."),
        ('Secure Code Review', "Revue de code axée sécurité."),
        ('Database Activity Monitoring', "Surveillance des accès aux bases de données."),
    ],
    'System & Risk': [
        ('Vulnerability/Patch Management', "Gestion des vulnérabilités et des correctifs."),
        ('ISO 27001/HIPAA/PCI, SOC', "Cadres de conformité de sécurité."),
        ('Audit and Compliance Analysis', "Analyse d'audit et de conformité."),
    ],
})

# ─────────────────────────── Menaces & attaques (carte « Security Automation ») ─────
MAPS['ig_secauto'] = ('Menaces & attaques', {
    'Application Security': [
        ('Authentication and Authorization', "Vérifier l'identité puis les droits d'accès."),
        ('Input Validation', "Valider les entrées pour éviter les injections."),
        ('Session Management', "Gérer les sessions de façon sécurisée."),
    ],
    'Identity Theft': [
        ('Medical Identity Theft', "Usurpation d'identité à des fins médicales."),
        ('Financial Fraud', "Fraude financière par usurpation d'identité."),
        ('Tax Identity Theft', "Usurpation pour une fraude fiscale."),
    ],
    'Password Attack': [
        ('Brute Force Attacks', "Essais exhaustifs de mots de passe."),
        ('Dictionary Attacks', "Essais fondés sur une liste de mots probables."),
        ('Credential Stuffing', "Réutilisation de couples identifiant/mot de passe volés."),
    ],
    'Malicious Code': [
        ('Ransom Attacks', "Rançongiciel chiffrant les données contre paiement."),
        ('Botnets', "Réseau de machines compromises pilotées à distance."),
        ('Payloads and Exploits', "Charges utiles et exploitations de failles."),
    ],
    'E-mail Attack': [
        ('Phishing', "Hameçonnage par email."),
        ('Spear Phishing', "Hameçonnage ciblé."),
        ('Business Email Compromise (BEC)', "Fraude par usurpation d'email professionnel."),
        ('Email Spoofing', "Falsification de l'expéditeur d'un email."),
    ],
    'Financial & Cyber Crime': [
        ('Ransomware Attacks', "Attaques par rançongiciel."),
        ('Insider Threats', "Menaces internes (employés, prestataires)."),
        ('Cyber Espionage', "Espionnage informatique."),
        ('Data Breaches', "Violations de données."),
    ],
    'Hacking': [
        ('Different Types of Hackers', "Black/white/grey hat selon l'intention."),
        ('Malicious Intent', "Intention malveillante de l'attaquant."),
        ('Unauthorized Access', "Accès non autorisé à un système."),
    ],
})

# ─────────────────────────── DevOps ───────────────────────────
MAPS['ig_devops'] = ('DevOps', {
    'Fondations': [
        ('Programming Languages', "Python, Go, JavaScript, Ruby : langages courants en DevOps."),
        ('Server Administration', "Administration Linux, Unix, Windows."),
        ('Network and Security', "TCP/IP, DNS, HTTP/s, FTP, SSL."),
    ],
    'Servers & Databases': [
        ('Web Server', "Apache, Nginx, Tomcat, IIS, Jetty."),
        ('Caching', "Redis, Memcache : mise en cache."),
        ('SQL', "MySQL/MariaDB, PostgreSQL, Oracle, MS-SQL."),
        ('NoSQL', "MongoDB, Cassandra, DynamoDB : bases non relationnelles."),
    ],
    'Infrastructure as Code': [
        ('Container Orchestrators', "Kubernetes, OpenShift, Nomad, Docker Swarm."),
        ('Container', "Docker, rkt, LXC : conteneurisation."),
        ('Configuration Management', "Ansible, Puppet, Chef, Salt Stack."),
        ('Infrastructure Provisioning', "Terraform, CloudFormation, Azure Template."),
    ],
    'CI/CD': [
        ('Jenkins', "Serveur d'intégration/déploiement continu."),
        ('GitLab CI', "CI/CD intégré à GitLab."),
        ('GitHub Actions', "Automatisation CI/CD dans GitHub."),
        ('CI/CD Pipeline', "Chaîne d'intégration et de déploiement continus."),
    ],
    'Monitoring & Clouds': [
        ('Monitoring', "Zabbix, Prometheus, Grafana, DataDog."),
        ('Logging', "ELK, Graylog, Splunk : centralisation des journaux."),
        ('Clouds', "AWS, Azure, GCP, OpenStack."),
    ],
})


def main():
    branches = {}
    concepts = []
    seen = set()
    for key, (label, cats) in MAPS.items():
        branches[key] = label
        for cat, items in cats.items():
            for term, dfn in items:
                k = term.strip().lower()
                if k in seen:
                    continue
                seen.add(k)
                c = {'term': term, 'cat': cat, 'branch': key, 'tip': label + ' · ' + cat}
                if dfn:
                    c['def'] = dfn
                concepts.append(c)

    data = {'source': SOURCE, 'branches': branches, 'concepts': concepts}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    with_def = sum(1 for c in concepts if c.get('def'))
    print(f"{len(concepts)} concepts ({with_def} avec définition) -> {os.path.relpath(OUT, ROOT)} "
          f"({os.path.getsize(OUT) / 1024:.0f} Ko)")
    for k, (label, _) in MAPS.items():
        n = sum(1 for c in concepts if c['branch'] == k)
        nd = sum(1 for c in concepts if c['branch'] == k and c.get('def'))
        print(f"  {label:22s} {n:>3} concepts ({nd} déf.)")


if __name__ == '__main__':
    main()
