// A real initialized data range, with independently recognizable endpoints.
volatile unsigned char baa_large_payload[BAA_PAYLOAD_BYTES] = {
    [0] = 0x5a, [BAA_PAYLOAD_BYTES - 1] = 0xa5};

__attribute__((noinline, used)) int baa_large_entry(void) {
  return baa_large_payload[0] + baa_large_payload[BAA_PAYLOAD_BYTES - 1];
}

int main(void) { return baa_large_entry(); }
