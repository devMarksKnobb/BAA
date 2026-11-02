/* Freestanding, source-owned static-analysis fixture. Never executed by BAA. */
volatile unsigned int baa_mips_global = 7;
const char baa_mips_marker[] = "baa-mips-source-owned-fixture";

__attribute__((noinline)) unsigned int baa_mips_leaf(unsigned int value)
{
    return value * 3u + baa_mips_global;
}

__attribute__((noinline)) unsigned int baa_mips_entry(unsigned int selector)
{
    unsigned int adjusted = selector > 10u ? selector : selector + 1u;
    return baa_mips_leaf(adjusted) + (unsigned char)baa_mips_marker[0];
}
