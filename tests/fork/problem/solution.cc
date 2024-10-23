#include <sys/types.h>
#include <unistd.h>
#include <iostream>

int main() {
    int r = fork();
    if (r == 0) {
        //Child
        std::cout << "Hello World!" << std::endl;
    }
}