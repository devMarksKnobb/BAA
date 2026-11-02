#include <stdio.h>

volatile int baa_c_global = 7;

#define BAA_LONG_CHUNK "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
#define BAA_LONG_256 BAA_LONG_CHUNK BAA_LONG_CHUNK BAA_LONG_CHUNK BAA_LONG_CHUNK
#define BAA_LONG_1024 BAA_LONG_256 BAA_LONG_256 BAA_LONG_256 BAA_LONG_256
/* Keep the full-size literal even when a loader does not type it as a string. */
__attribute__((used)) const char baa_long_literal[] =
    "BAA_LONG_LITERAL_" BAA_LONG_1024 BAA_LONG_1024 BAA_LONG_1024 BAA_LONG_1024 "needle";
/* Verified Hopper loaders recognize this extent and split it into native objects. */
__attribute__((used)) const char baa_fragmented_literal[] =
    "BAA_FRAGMENTED_LITERAL_" BAA_LONG_256 BAA_LONG_256 "fragment_tail";
__attribute__((used)) const char baa_utf8_literal[] = "BAA_UTF8_é_😀";
__attribute__((used)) const char baa_ellipsis_literal[] = "BAA_LITERAL_…";
__attribute__((used)) const char baa_latin1_literal[] = "BAA_LATIN1_\xff";

__attribute__((noinline, used)) void baa_long_literal_procedure(void) {
  puts(baa_long_literal);
  puts(baa_fragmented_literal);
  puts(baa_utf8_literal);
  puts("BAA_ESCAPED_\"\\line\nend\t\r");
  puts("BAA_LITERAL_BACKSLASH_\\n");
  puts(baa_ellipsis_literal);
  puts(baa_latin1_literal);
}

__attribute__((noinline, used)) int baa_leaf(int value) {
  puts("BAA_C_LEAF");
  return value + baa_c_global;
}

__attribute__((noinline, used)) int baa_branch(int value) {
  return value > 3 ? baa_leaf(value) : baa_leaf(-value);
}

__attribute__((noinline, used)) int baa_entry(void) {
  puts("BAA_C_ENTRY");
  /* Give the native locals oracle explicit stack storage. */
  volatile int input = 5;
  return baa_branch(input);
}

int main(void) { return baa_entry() == 12 ? 0 : 1; }

__attribute__((noinline, used)) int baa_cycle_b(int value);

__attribute__((noinline, used)) int baa_cycle_a(int value) {
  return value > 0 ? baa_cycle_b(value - 1) : value;
}

__attribute__((noinline, used)) int baa_cycle_b(int value) {
  return value > 0 ? baa_cycle_a(value - 1) : value;
}
