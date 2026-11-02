__attribute__((noinline)) int baa_pie_add(int value) {
    return value + 7;
}

int baa_pie_entry(void) {
    return baa_pie_add(35);
}
