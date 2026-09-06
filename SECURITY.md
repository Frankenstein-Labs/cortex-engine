# Sécurité — Cortex Engine

## Principe

Les agents sont traités comme des programmes potentiellement dangereux. Cortex Engine ne donne jamais implicitement :

- Accès root à l'hôte
- Accès aux secrets
- Accès réseau illimité
- Accès au système de fichiers illimité
- Accès à l'hôte sans isolation

## Isolation

L'isolation est obligatoire :

```
HOST
 ├── VM / Container par agent
 │     ├── Workspace (worktree Git)
 │     ├── Runtime
 │     └── Outils autorisés
 └── Cortex Engine (orchestrateur)
```

## Permissions

Chaque action nécessite une permission explicite :

| Action | Risque |
|--------|--------|
| `filesystem.read` | Faible |
| `filesystem.write` | Moyen |
| `filesystem.delete` | Élevé |
| `terminal.execute` | Élevé |
| `git.push` | Élevé |
| `network.access` | Élevé |
| `browser.use` | Moyen |
| `vm.create` | Élevé |
| `secret.access` | Critique |

## Human-in-the-Loop

Certaines actions nécessitent une approbation humaine :

- Suppression massive de fichiers
- Accès aux secrets
- Push / merge Git
- Déploiement
- Accès réseau sensible
- Installation d'extensions
- Création / suppression de VM

## Politique de sécurité

1. **Défense en profondeur** : permissions + isolation + monitoring
2. **Principe du moindre privilège** : permissions minimales par agent
3. **Auditabilité** : tous les événements sont tracés
4. **Réversibilité** : rollback, worktrees, snapshots

## Configuration

```json
{
  "permissions": {
    "defaultEffect": "deny",
    "rules": [
      { "action": "filesystem.read", "effect": "allow" },
      { "action": "filesystem.write", "effect": "allow", "resource": "workspace/*" },
      { "action": "terminal.execute", "effect": "deny" }
    ]
  },
  "network": {
    "allowedHosts": ["npmjs.org", "github.com"],
    "blockedHosts": ["*"]
  }
}
```

## Signaler une faille

Signaler les problèmes de sécurité via le dépôt GitCortex avec le label `security`.
