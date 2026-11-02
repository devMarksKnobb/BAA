/* Source-owned 32-bit PowerPC instructions with fixed, reviewable encodings.
 * No target execution. The conditional branch at +8 targets +16.
 */
.text
.p2align 2
.globl baa_ppc_probe
.type baa_ppc_probe, @function
baa_ppc_probe:
    addi 3, 4, 0x1234
    cmpwi 0, 4, 0
    beq 0, .Lzero
    blr
.Lzero:
    li 3, 7
    blr
.size baa_ppc_probe, .-baa_ppc_probe
.section .note.GNU-stack,"",@progbits
