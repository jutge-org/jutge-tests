#include <iostream>
#include <cstdint>
using namespace std;

int main() {
    for (int i = 0; ; ++i) {
        uint8_t* a = new uint8_t[1024*1024];
        cout << i << endl;
        (void)a;
    }
}
