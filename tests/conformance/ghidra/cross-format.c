typedef int (*baa_cross_callback)(int);

volatile int baa_cross_global = 7;
const volatile char baa_cross_message[] = "BAA_GHIDRA_CROSS_FORMAT";

__attribute__((noinline, used)) int baa_cross_leaf(int value) {
  return value + baa_cross_global + baa_cross_message[0] - 'R';
}

__attribute__((noinline, used)) int baa_cross_branch(int value) {
  /* A volatile-dependent loop keeps this callee multi-block at every
     optimization level: newer clang folds a symmetric if/else of tail calls
     into a conditional negate, and cross-format verification requires a
     recovered multi-block callee. */
  int adjusted = value > 10 ? value + 1 : -value;
  while (adjusted > 100) {
    adjusted -= baa_cross_global;
  }
  return baa_cross_leaf(adjusted);
}

__attribute__((noinline, used)) int baa_cross_indirect(
    baa_cross_callback callback, int value) {
  return callback(value);
}

#define BAA_CROSS_SWITCH_CASE(case_value) \
  case case_value:                        \
    return baa_cross_leaf(payload + case_value)

__attribute__((noinline, used)) int baa_cross_dense_switch(unsigned int selector,
                                                           int payload) {
  switch (selector) {
    BAA_CROSS_SWITCH_CASE(0);
    BAA_CROSS_SWITCH_CASE(1);
    BAA_CROSS_SWITCH_CASE(2);
    BAA_CROSS_SWITCH_CASE(3);
    BAA_CROSS_SWITCH_CASE(4);
    BAA_CROSS_SWITCH_CASE(5);
    BAA_CROSS_SWITCH_CASE(6);
    BAA_CROSS_SWITCH_CASE(7);
    BAA_CROSS_SWITCH_CASE(8);
    BAA_CROSS_SWITCH_CASE(9);
    BAA_CROSS_SWITCH_CASE(10);
    BAA_CROSS_SWITCH_CASE(11);
    BAA_CROSS_SWITCH_CASE(12);
    BAA_CROSS_SWITCH_CASE(13);
    BAA_CROSS_SWITCH_CASE(14);
    BAA_CROSS_SWITCH_CASE(15);
    BAA_CROSS_SWITCH_CASE(16);
    BAA_CROSS_SWITCH_CASE(17);
    BAA_CROSS_SWITCH_CASE(18);
    BAA_CROSS_SWITCH_CASE(19);
    BAA_CROSS_SWITCH_CASE(20);
    BAA_CROSS_SWITCH_CASE(21);
    BAA_CROSS_SWITCH_CASE(22);
    BAA_CROSS_SWITCH_CASE(23);
    BAA_CROSS_SWITCH_CASE(24);
    BAA_CROSS_SWITCH_CASE(25);
    BAA_CROSS_SWITCH_CASE(26);
    BAA_CROSS_SWITCH_CASE(27);
    BAA_CROSS_SWITCH_CASE(28);
    BAA_CROSS_SWITCH_CASE(29);
    BAA_CROSS_SWITCH_CASE(30);
    BAA_CROSS_SWITCH_CASE(31);
    BAA_CROSS_SWITCH_CASE(32);
    BAA_CROSS_SWITCH_CASE(33);
    BAA_CROSS_SWITCH_CASE(34);
    BAA_CROSS_SWITCH_CASE(35);
    BAA_CROSS_SWITCH_CASE(36);
    BAA_CROSS_SWITCH_CASE(37);
    BAA_CROSS_SWITCH_CASE(38);
    BAA_CROSS_SWITCH_CASE(39);
    default:
      return -1;
  }
}

#undef BAA_CROSS_SWITCH_CASE

__attribute__((noinline, used, visibility("default"))) int baa_cross_entry(void) {
  return baa_cross_branch(35) + baa_cross_indirect(baa_cross_leaf, 0);
}

__attribute__((used, visibility("default"))) void baa_cross_start(void) {
  volatile int result = baa_cross_entry();
  (void)result;
  for (;;) {
  }
}
