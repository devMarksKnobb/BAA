#include <stdio.h>
__attribute__((noinline, used)) int baa_version_leaf(void) {
  puts("BAA_VERSION_TWO");
  return 2;
}
__attribute__((noinline, used)) int baa_added(void) { return 40; }
__attribute__((noinline, used)) int baa_version_entry(void) {
  return baa_version_leaf() + baa_added();
}
int main(void) { return baa_version_entry() == 42 ? 0 : 1; }
