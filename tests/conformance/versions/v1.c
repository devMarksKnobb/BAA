#include <stdio.h>
__attribute__((noinline, used)) int baa_version_leaf(void) {
  puts("BAA_VERSION_ONE");
  return 1;
}
__attribute__((noinline, used)) int baa_version_entry(void) {
  return baa_version_leaf();
}
int main(void) { return baa_version_entry() == 1 ? 0 : 1; }
