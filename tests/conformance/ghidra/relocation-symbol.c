/* Static ELF fixture: no target code is executed by the verifier. */
extern int baa_external(int);
int (*volatile baa_external_slot)(int) = baa_external;
__attribute__((visibility("hidden"), noinline, used)) int baa_local(int value) {
  return value + 1;
}
int (*volatile baa_local_slot)(int) = baa_local;
