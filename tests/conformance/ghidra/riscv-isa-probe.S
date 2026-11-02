/* Zifencei and Zicsr oracle for the soft-float fixture, independent of the
 * compiler's C code generation. Returns its argument unchanged. */
.section .text
.option norvc
.global baa_riscv_isa_probe
.type baa_riscv_isa_probe, @function
baa_riscv_isa_probe:
    fence.i
    csrr t0, mcycle
    ret
.size baa_riscv_isa_probe, .-baa_riscv_isa_probe
