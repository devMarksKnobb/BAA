/* Source-owned mixed-instruction shared-image control. */
.abicalls
.module fp=xx
.module nooddspreg
.text
.set noreorder
.set nomicromips
.set mips16
.globl baa_mips16_probe
.type baa_mips16_probe, @function
.ent baa_mips16_probe
baa_mips16_probe:
    li $2, 90
    xor $2, $4
    addiu $2, 7
    jrc $31
.end baa_mips16_probe
.size baa_mips16_probe, . - baa_mips16_probe
.ifndef BAA_MIPS_SYMBOL_RELATIVE
.hidden baa_mips16_probe
.endif

.set nomips16
.globl baa_mips32_probe
.type baa_mips32_probe, @function
.ent baa_mips32_probe
baa_mips32_probe:
    addiu $2, $4, 3
    jr $31
    nop
.end baa_mips32_probe
.size baa_mips32_probe, . - baa_mips32_probe

.data
.balign 4
.globl baa_mips16_pointer
.type baa_mips16_pointer, @object
.size baa_mips16_pointer, 4
baa_mips16_pointer:
    .word baa_mips16_probe
.section .note.GNU-stack, "", @progbits
