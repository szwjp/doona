Fixed

- A rule whose condition quotes a parameter is anchored again: the engine drops the quotes when it renders an expression, and only the condition ignores them, so the DNS upstream name `'my dns'` still has to match exactly.
