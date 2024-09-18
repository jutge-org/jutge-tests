#include <iostream>
using namespace std;

int main() {
    char* b;
    for (int i = 0; ; ++i) {
        char* a = new char[1024*1024];
        cout << i << endl;
        b = a;
    }
}
