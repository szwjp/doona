Fixed

- A section is written in the file that holds it: when that file's text cannot be written back, the page offers no way to edit the section instead of adding a second copy in another file. An engine whose entry file is read-only and whose sections live in includes keeps writing those includes.
- The mode card no longer waits for a completeness check that never ran, so a readable configuration turns writable as soon as it is read.
