---
description: Commit de los cambios con descripción corta + push a la rama actual
---

Genera un commit con los cambios actuales del repo y haz push a la rama actual.

Estado actual (generado al invocar el comando):

!`git status --short; git diff --stat`

Pasos:
1. Revisa el diff (`git diff`) para describir con precisión lo hecho, sin inventar nada.
2. Haz stage con `git add -A` (el `.gitignore` ya excluye `node_modules/`, `dist/` y `.env`).
3. Commit en español: título corto (máx. 72 caracteres, imperativo, p. ej. "Añade favoritas y persistencia de filtros") + cuerpo breve con los cambios principales.
4. Averigua la rama con `git branch --show-current` y haz `git push origin <rama>`. Si el push falla, muestra el error tal cual.

Contexto extra: $ARGUMENTS
