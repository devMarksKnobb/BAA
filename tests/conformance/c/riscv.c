/* Source-owned freestanding analysis fixture. Never execute this target. */
volatile unsigned int baa_riscv_global = 7;
extern unsigned int baa_riscv_probe(unsigned int value);

__attribute__((noinline)) unsigned int baa_riscv_leaf(unsigned int value)
{
    return value * 3u + baa_riscv_global;
}

__attribute__((noinline)) double baa_riscv_float(double left, double right)
{
    return left + right;
}

__attribute__((noinline)) unsigned int baa_riscv_entry(unsigned int selector)
{
    return baa_riscv_probe(baa_riscv_leaf(selector + 1u));
}
