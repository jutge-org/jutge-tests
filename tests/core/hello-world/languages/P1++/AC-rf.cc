#include <iostream>
#include <unistd.h>
using namespace std;

// We allow system calls like getpid.

int main() {
    (void)getpid();
    cout << "Hello world!" << endl;
}
