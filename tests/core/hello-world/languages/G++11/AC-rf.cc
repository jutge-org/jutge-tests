#include <iostream>
#include <unistd.h>
using namespace std;

int main() {
    (void) getpid();
    cout << "Hello world!" << endl;
}
