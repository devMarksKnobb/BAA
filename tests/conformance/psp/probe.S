/* Source-owned Allegrex decoding probe. This fixture is never executed. */
.set noreorder
.text
.align 2
.globl baa_psp_probe
.type baa_psp_probe, @function
.ent baa_psp_probe
baa_psp_probe:
  addiu $v0, $zero, 0x1234
  bitrev $v0, $v0
  jr $ra
  nop
.end baa_psp_probe
.size baa_psp_probe, .-baa_psp_probe
