#include <pspkernel.h>

PSP_MODULE_INFO("baa_psp_fixture", 0, 1, 0);
#ifndef BAA_PSP_GLOBAL
#define BAA_PSP_GLOBAL 7
#endif
volatile unsigned int baa_psp_global = BAA_PSP_GLOBAL;
const char baa_psp_marker[] = "baa-psp-source-owned-fixture";
unsigned int baa_psp_probe(void);

__attribute__((noinline)) unsigned int baa_psp_leaf(unsigned int value) {
  return value * 3u + baa_psp_global;
}
__attribute__((noinline)) unsigned int baa_psp_entry(unsigned int selector) {
  unsigned int adjusted = selector > 10u ? selector : selector + 1u;
  return baa_psp_leaf(adjusted) + baa_psp_probe();
}
int main(void) {
  return (int)baa_psp_entry(11u);
}
