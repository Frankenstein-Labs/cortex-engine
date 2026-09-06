# Contribuer à Cortex Engine

## Structure du dépôt

```
cortex-engine/
├── packages/
│   ├── core/           # Types, interfaces, event system, permissions
│   ├── agent/          # Agent runtime, session, pool
│   ├── orchestrator/   # Orchestrator, communication, mission
│   ├── runtime/        # Runtime interfaces + implémentations
│   ├── tools/          # Outils natifs
│   └── cli/            # CLI
├── README.md
├── ARCHITECTURE.md
├── SECURITY.md
└── CONTRIBUTING.md
```

## Workflow

1. Fork / clone
2. Créer une branche feature
3. Implémenter avec tests
4. Linter et tester
5. Commit avec message conventionnel
6. Ouvrir une PR

## Conventions de code

- TypeScript strict
- Pas de `any` sans justification
- Pas de `TODO` / `FIXME` sans ticket associé
- Tests unitaires pour chaque fonctionnalité
- JSDoc pour les APIs publiques

## Tests

```bash
pnpm build
pnpm test
```

## Commit messages

```
type(scope): description

Types: feat, fix, docs, test, refactor, chore
```

Exemples :

- `feat(orchestrator): add dynamic agent pool scaling`
- `fix(runtime): handle process spawn errors`
- `test(tools): add terminal execution tests`
