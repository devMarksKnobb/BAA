#include <stdlib.h>
#include <string.h>
#include <errno.h>

extern void *__tls_get_addr(void *);
extern int *__errno_location(void);
extern void baa_unknown_stop(void);
extern void _Unwind_Resume(void *) __attribute__((noreturn));
volatile unsigned long baa_after_call;

void *baa_malloc(size_t n) {
    void *p = malloc(n);
    baa_after_call++;
    return p;
}
void *baa_malloc_adjacent(size_t n) {
    void *p = malloc(n);
    baa_after_call++;
    return p;
}
__attribute__((visibility("hidden"))) void *baa_tls(void *p) {
    void *value = __tls_get_addr(p);
    baa_after_call++;
    return value;
}
__attribute__((visibility("hidden"))) void *baa_tls_chain(void *p) {
    void *value = baa_tls(p);
    baa_after_call++;
    return value;
}
void *baa_tls_outer(void *p) {
    void *value = baa_tls_chain(p);
    baa_after_call++;
    return value;
}
void *baa_memcpy(void *out, const void *in, size_t n) {
    void *value = memcpy(out, in, n);
    baa_after_call++;
    return value;
}
void *baa_memset(void *out, int c, size_t n) {
    void *value = memset(out, c, n);
    baa_after_call++;
    return value;
}
size_t baa_strlen(const char *p) {
    size_t value = strlen(p);
    baa_after_call++;
    return value;
}
int *baa_errno(void) {
    int *p = __errno_location();
    baa_after_call++;
    return p;
}
void baa_unknown(void) {
    baa_unknown_stop();
    baa_after_call++;
}
void baa_abort(void) { abort(); }
void baa_unwind(void *p) { _Unwind_Resume(p); }
void baa_local_stop(void) { __builtin_trap(); }
int baa_local_return(void) { return 1658; }
