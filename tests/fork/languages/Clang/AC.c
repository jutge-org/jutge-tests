#include <sys/types.h>
#include <unistd.h>
#include <stdio.h>

int main() {
    int r = fork();
    if (r == 0) {
        //Child
        printf("Hello World\n");
    }
}