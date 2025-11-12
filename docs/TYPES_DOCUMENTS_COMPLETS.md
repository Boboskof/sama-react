# 📄 Liste complète des types de documents

Cette liste contient tous les types de documents disponibles dans le système frontend, à intégrer dans le backend.

## 📋 Justificatifs requis (4 types)

Ces types sont utilisés pour la vérification automatique des dossiers patients complets :

- `CARTE_IDENTITE` - Carte d'identité
- `CARTE_VITALE` - Carte vitale
- `CONTACTS_URGENCE` - Formulaire de contacts d'urgence
- `CARTE_MUTUELLE` - Carte mutuelle

## 📝 Documents de prescription (2 types)

- `ORDONNANCE` - Ordonnance
- `PRESCRIPTION_EXAMEN` - Prescription d'examen

## 🖼️ Imagerie médicale (4 types)

- `RADIOGRAPHIE` - Radiographie
- `ECHOGRAPHIE` - Échographie
- `ENDOSCOPIE` - Endoscopie
- `DERMATOSCOPIE` - Dermatoscopie

## 🔬 Résultats d'examens (4 types)

- `ANALYSES_BIOLOGIQUES` - Analyses biologiques
- `ANALYSES_ANATOMOPATHOLOGIQUES` - Analyses anatomopathologiques
- `ELECTROCARDIOGRAMME` - Électrocardiogramme
- `SPIROMETRIE` - Spirométrie

## 📄 Comptes-rendus médicaux (4 types)

- `COMPTE_RENDU_CONSULTATION` - CR de consultation
- `COMPTE_RENDU_HOSPITALISATION` - CR d'hospitalisation
- `COMPTE_RENDU_OPERATOIRE` - CR opératoire
- `COMPTE_RENDU_URGENCE` - CR d'urgence

## 📜 Certificats et attestations (3 types)

- `CERTIFICAT_MEDICAL` - Certificat médical
- `CERTIFICAT_DE_DECES` - Certificat de décès
- `ATTESTATION_MALADIE` - Attestation maladie

## 🏢 Documents administratifs (3 types)

- `FSE` - FSE (Feuille de Soins Électronique)
- `FACTURE_MEDICALE` - Facture médicale
- `CONVENTION_MEDICALE` - Convention médicale

## 📊 Documents de suivi (3 types)

- `DOSSIER_MEDICAL` - Dossier médical
- `PLAN_DE_SOINS` - Plan de soins
- `SUIVI_THERAPEUTIQUE` - Suivi thérapeutique

## 🎯 Documents spécialisés (3 types)

- `PSYCHOLOGIE` - Psychologie
- `KINESITHERAPIE` - Kinésithérapie
- `DIETETIQUE` - Diététique

## 🚨 Documents d'urgence (2 types)

- `FICHE_DE_LIAISON` - Fiche de liaison
- `PROTOCOLE_URGENCE` - Protocole d'urgence

## 🔬 Documents de recherche (2 types)

- `ETUDE_CLINIQUE` - Étude clinique
- `PUBLICATION_MEDICALE` - Publication médicale

## 🔄 Autre

- `AUTRE` - Autre (type par défaut pour documents non catégorisés)

---

## 📊 Résumé

**Total : 36 types de documents**

### Par catégorie :
- Justificatifs requis : 4
- Documents de prescription : 2
- Imagerie médicale : 4
- Résultats d'examens : 4
- Comptes-rendus médicaux : 4
- Certificats et attestations : 3
- Documents administratifs : 3
- Documents de suivi : 3
- Documents spécialisés : 3
- Documents d'urgence : 2
- Documents de recherche : 2
- Autre : 1

## 🔍 Détection automatique des justificatifs

Le backend doit détecter automatiquement les justificatifs requis en analysant le nom du fichier uploadé. Les mots-clés à rechercher sont :

### CARTE_IDENTITE
- "identite", "cni", "carte identite", "carte d'identité"

### CARTE_VITALE
- "vitale", "carte vitale", "carte vitale"

### CONTACTS_URGENCE
- "urgence", "contact", "personne contact", "contacts d'urgence", "formulaire contact"

### CARTE_MUTUELLE
- "mutuelle", "carte mutuelle", "assurance", "complémentaire"

## 💡 Notes d'implémentation

1. **Enum backend** : Créer un enum `TypeDocument` avec tous ces types
2. **Détection automatique** : Implémenter la logique de détection basée sur le nom de fichier lors de l'upload
3. **Validation** : Valider que le type fourni par le frontend correspond à un type valide
4. **Compatibilité** : Le frontend envoie parfois un type "legacy" (ex: `COMPTE_RENDU` au lieu de `COMPTE_RENDU_CONSULTATION`) pour compatibilité, mais le type détaillé est préféré

## 🔄 Mapping legacy (pour compatibilité)

Le frontend peut envoyer des types "legacy" qui doivent être mappés :

- `ORDONNANCE` ou `PRESCRIPTION_EXAMEN` → `ORDONNANCE`
- `RADIOGRAPHIE`, `ECHOGRAPHIE`, `ENDOSCOPIE`, `DERMATOSCOPIE` → `RADIOGRAPHIE`
- `COMPTE_RENDU_*` → `COMPTE_RENDU`
- `CERTIFICAT_*` ou `ATTESTATION_MALADIE` → `CERTIFICAT`
- `FSE` → `FSE`
- `ANALYSES_*`, `ELECTROCARDIOGRAMME`, `SPIROMETRIE`, etc. → `COMPTE_RENDU`
- Justificatifs (`CARTE_IDENTITE`, `CARTE_VITALE`, `CONTACTS_URGENCE`, `CARTE_MUTUELLE`) → garder tel quel


