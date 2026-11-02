/* Relocatable (ET_REL) static-analysis fixture, built with -c -G0 and never
 * executed or linked by BAA. It exercises the relocations Linux MIPS kernel
 * modules use: R_MIPS_26 calls, HI16/LO16 address pairs (one HI16 shared by
 * several LO16s, two HI16s resolved by one LO16, and a LO16 >= 0x8000 that
 * forces a HI16 carry), R_MIPS_32
 * data words, and undefined external code and data symbols. powf is an
 * external whose float prototype Ghidra's C library archive supplies by name,
 * so soft-float builds must give it the soft-float prototype too.
 */
extern int baa_mips_rel_external(int value);
extern int baa_mips_rel_external_data;
extern float powf(float base, float exponent);

struct baa_mips_rel_pair {
    int first;
    int second;
};

struct baa_mips_rel_pair baa_mips_rel_pair = { 0x1111, 0x2222 };
/* Places baa_mips_rel_carry past a signed 16-bit low-half boundary. */
char baa_mips_rel_padding[0x8000] = { 1 };
int baa_mips_rel_carry = 0x3333;
/* Referenced only by baa_mips_rel_highs, so its single LO16 stays unique. */
int baa_mips_rel_highs_target = 0x4444;
static const char baa_mips_rel_marker[] = "baa-mips-relocatable-fixture";

__attribute__((noinline)) int baa_mips_rel_leaf(int value)
{
    return value * 3 + baa_mips_rel_pair.first + baa_mips_rel_pair.second;
}

__attribute__((noinline, long_call)) int baa_mips_rel_far(int value);

int baa_mips_rel_far(int value)
{
    return value + baa_mips_rel_marker[value & 7] + baa_mips_rel_carry;
}

int (*const baa_mips_rel_table[])(int) = {
    baa_mips_rel_leaf,
    baa_mips_rel_far,
    baa_mips_rel_external,
};

__attribute__((noinline)) int baa_mips_rel_scaled(int value)
{
    float scaled = powf(1.5f, 2.5f);
    return value ^ *(int *)&scaled;
}

/* Most GCC-built kernel modules checked contain LO16s that resolve several
 * pending HI16s; Clang does not produce that from C. Two %hi and exactly one
 * %lo of a symbol nothing else references: any assembler that orders each
 * HI16 before a matching LO16 (GNU as, every LLVM version) must emit both
 * HI16s ahead of that single LO16, which therefore resolves both.
 */
__asm__(".text\n"
        ".globl baa_mips_rel_highs\n"
        ".type baa_mips_rel_highs, @function\n"
        ".set push\n"
        ".set noreorder\n"
        "baa_mips_rel_highs:\n"
        "    lui $2, %hi(baa_mips_rel_highs_target)\n"
        "    lui $3, %hi(baa_mips_rel_highs_target)\n"
        "    addiu $2, $2, %lo(baa_mips_rel_highs_target)\n"
        "    jr $31\n"
        "    move $3, $2\n"
        ".set pop\n"
        ".size baa_mips_rel_highs, .-baa_mips_rel_highs\n");

int baa_mips_rel_entry(int value)
{
    return baa_mips_rel_leaf(value) + baa_mips_rel_far(value) +
        baa_mips_rel_external(value) + baa_mips_rel_external_data +
        baa_mips_rel_table[value & 1](value) + baa_mips_rel_scaled(value);
}
