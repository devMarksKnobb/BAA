#ifdef _WIN32
#define BAA_EXPORT __declspec(dllexport)
#define BAA_NOINLINE __declspec(noinline)
#else
#define BAA_EXPORT __attribute__((visibility("default")))
#define BAA_NOINLINE __attribute__((noinline))
#endif

BAA_EXPORT BAA_NOINLINE int baa_fixture_add(int left, int right) {
  return left + right + 7;
}

BAA_EXPORT BAA_NOINLINE int baa_fixture_subtract(int left, int right) {
  return left - right - 13;
}

int main(void) {
  return baa_fixture_add(11, 24) + baa_fixture_subtract(24, 11);
}
