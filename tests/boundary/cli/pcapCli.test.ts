import { expect, it } from "vitest";

import { expectConfigurationRefusal, serveCli } from "./cliServeHarness.js";

it.each([
  ["inspect-pcap-client"],
  ["inspect-pcap-capture", "/nonexistent/capture.pcap"],
])("%s names the missing Wireshark tool to configure", async (...argv) => {
  const result = await serveCli([...argv, "--json"], {
    BAA_TSHARK_COMMAND: "/nonexistent/tshark",
    BAA_CAPINFOS_COMMAND: "/nonexistent/capinfos",
  });
  expectConfigurationRefusal(
    result,
    "The selected tshark executable /nonexistent/tshark could not be found",
  );
  expectConfigurationRefusal(result, "through absolute BAA_TSHARK_COMMAND");
});

it("names a relative tool selection as configuration to fix", async () => {
  const result = await serveCli(["inspect-pcap-client", "--json"], {
    BAA_TSHARK_COMMAND: "tshark",
  });
  expectConfigurationRefusal(
    result,
    "BAA_TSHARK_COMMAND must be an absolute path to the tshark binary",
  );
});
