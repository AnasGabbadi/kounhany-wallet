1. Format exact du client_id universel
    UUID Authentik ?     → "550e8400-e29b-41d4-a716-446655440000"

2. Architecture — direct ou via API Gateway
    App Fleet → POST /orders → Notre Wallet

3. Authentification inter-apps — JWT ou API Key 
    -> JWT Authentik

4. Format payload commande — validation du schéma
    {
        "client_id": "???",
        "order_type": "FLEET",
        ...
        "metadata": {...}
    }

5. FLEET — qui déclenche le CONFIRM ?
    L'admin Kounhany confirme via le dashboard wallet

6. LOGISTIQUE — cron auto ou manuel fin de mois ? 
    -> Cron automatique

7. B2C — documentation CMI disponible ?
    - URL de callback à configurer chez CMI
    - Format du payload CMI
    - Algorithme de signature HMAC
    - Clé secrète CMI
    - Environnement de test CMI

8. Gestion erreurs — que faire si solde insuffisant ?
    On retourne HTTP 422 + message ?