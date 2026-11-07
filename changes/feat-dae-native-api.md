Fixed

- The routing and DNS rule lists locate their lines when the engine reports each rule's source text as its expression and names the source it was written in: the condition is compared up to its first top-level arrow, and a must target compares as one however it is spelled (`must_direct`, `direct(must)` or the engine's `direct("must")`). Rules with quoted parameters, continued conditions and `fallback:` targets, including a must fallback, stay editable from the rule pages and the quick-rule dialogs.
- Editing a rule's condition keeps its target as the source wrote it, so a must rule is not rewritten into another spelling.
