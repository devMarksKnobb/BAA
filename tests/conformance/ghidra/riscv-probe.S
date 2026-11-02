/* Fixed instruction oracle, independent of the compiler's C code generation. */
.section .text
.option norvc
.global baa_riscv_probe
.type baa_riscv_probe, @function
baa_riscv_probe:
    addi a0, a0, 17
    ret
.size baa_riscv_probe, .-baa_riscv_probe
