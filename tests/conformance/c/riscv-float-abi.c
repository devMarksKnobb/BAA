/* Source-owned RISC-V calling-convention fixture. Never execute this target.
 * One source for every float ABI the lane verifies: float and double
 * arguments and returns, a double that starts in an odd register, a double
 * split between a7 and the stack, small structures of two floats and of a
 * float and an int, a large structure and a long double passed and returned
 * by reference, a variadic call with aligned double pairs, and an indirect
 * call through a typed pointer. It moves floating-point values without arithmetic or
 * comparisons, so a soft-float build links no compiler-rt helpers. The
 * expected storage per ABI is in tests/conformance/ghidra/riscv-checks.mjs.
 */
#include <stdarg.h>

volatile unsigned int baa_riscv_global = 7;
volatile unsigned int baa_riscv_abi_sink;
extern unsigned int baa_riscv_probe(unsigned int value);
extern unsigned int baa_riscv_isa_probe(unsigned int value);

struct baa_riscv_abi_pair {
    float x;
    float y;
};

struct baa_riscv_abi_tagged {
    float value;
    int tag;
};

struct baa_riscv_abi_large {
    double first;
    double second;
    float third;
};

__attribute__((noinline)) float baa_riscv_abi_pick(float a, float b, int sel)
{
    return sel ? a : b;
}

__attribute__((noinline)) double baa_riscv_abi_wide(double a, int sel)
{
    return sel ? a : 0.5;
}

__attribute__((noinline)) double baa_riscv_abi_mixed(int i, double d, float f, double e)
{
    baa_riscv_abi_sink = *(volatile unsigned int *)&f;
    return i ? d : e;
}

__attribute__((noinline)) double baa_riscv_abi_split(int a, int b, int c, int d, int e, int f, int g, double x)
{
    baa_riscv_abi_sink = (unsigned int)(a ^ b ^ c ^ d ^ e ^ f ^ g);
    return x;
}

__attribute__((noinline)) struct baa_riscv_abi_pair baa_riscv_abi_pair(struct baa_riscv_abi_pair value, float scale)
{
    struct baa_riscv_abi_pair swapped = { value.y, value.x };
    baa_riscv_abi_sink = *(volatile unsigned int *)&scale;
    return swapped;
}

__attribute__((noinline)) struct baa_riscv_abi_tagged baa_riscv_abi_tagged(struct baa_riscv_abi_tagged value, int tag)
{
    value.tag = tag;
    return value;
}

__attribute__((noinline)) struct baa_riscv_abi_large baa_riscv_abi_large(struct baa_riscv_abi_large value, float scale)
{
    value.third = scale;
    return value;
}

__attribute__((noinline)) long double baa_riscv_abi_quad(long double value, int sel)
{
    baa_riscv_abi_sink = (unsigned int)sel;
    return value;
}

__attribute__((noinline)) unsigned int baa_riscv_abi_variadic(int count, ...)
{
    va_list arguments;
    unsigned int folded = 0;
    va_start(arguments, count);
    for (int index = 0; index < count; index += 1) {
        double value = va_arg(arguments, double);
        folded ^= ((volatile unsigned int *)&value)[1];
        folded ^= (unsigned int)va_arg(arguments, int);
    }
    va_end(arguments);
    return folded;
}

/* Volatile so the indirect call through this typed pointer is not folded. */
float (*volatile baa_riscv_abi_callback)(float, float, int) = baa_riscv_abi_pick;

__attribute__((noinline)) unsigned int baa_riscv_abi_caller(int sel)
{
    float picked = baa_riscv_abi_pick(1.5f, 2.5f, sel);
    double wide = baa_riscv_abi_wide(3.25, sel);
    double mixed = baa_riscv_abi_mixed(sel, 4.75, 5.5f, 6.125);
    double split = baa_riscv_abi_split(1, 2, 3, 4, 5, 6, sel, 7.25);
    struct baa_riscv_abi_pair pair = baa_riscv_abi_pair((struct baa_riscv_abi_pair){ 8.5f, 9.5f }, 10.5f);
    struct baa_riscv_abi_tagged tagged = baa_riscv_abi_tagged((struct baa_riscv_abi_tagged){ 11.5f, 12 }, sel);
    struct baa_riscv_abi_large large = baa_riscv_abi_large((struct baa_riscv_abi_large){ 13.5, 14.5, 15.5f }, 16.5f);
    long double quad = baa_riscv_abi_quad(22.5L, sel);
    unsigned int folded = baa_riscv_abi_variadic(2, 17.5, sel, 18.5, 19);
    float called = baa_riscv_abi_callback(20.5f, 21.5f, sel);
    return *(unsigned int *)&picked ^ ((unsigned int *)&wide)[1] ^ ((unsigned int *)&mixed)[1] ^
        ((unsigned int *)&split)[1] ^ *(unsigned int *)&pair.x ^ (unsigned int)tagged.tag ^
        ((unsigned int *)&large.second)[1] ^ ((unsigned int *)&quad)[3] ^ folded ^ *(unsigned int *)&called;
}

__attribute__((noinline)) unsigned int baa_riscv_entry(unsigned int selector)
{
    return baa_riscv_probe(baa_riscv_isa_probe(baa_riscv_abi_caller((int)selector)) + baa_riscv_global);
}
