/* Freestanding, source-owned static-analysis fixture. Never executed by BAA. */
volatile unsigned int baa_ppc_global = 7;
const char baa_ppc_marker[] = "baa-ppc-source-owned-fixture";

__attribute__((noinline)) unsigned int baa_ppc_leaf(unsigned int value)
{
    return value * 3u + baa_ppc_global;
}

__attribute__((noinline)) unsigned int baa_ppc_entry(unsigned int selector)
{
    unsigned int adjusted = selector > 10u ? selector : selector + 1u;
    return baa_ppc_leaf(adjusted) + (unsigned char)baa_ppc_marker[0];
}
