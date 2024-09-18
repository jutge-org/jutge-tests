#include <stdio.h>

int main() {
    int i;
    char* p;
    for (i=0; ; ++i) {
        p = calloc(1024*1024, 1);
        printf("%i\n", i);
    }
}
