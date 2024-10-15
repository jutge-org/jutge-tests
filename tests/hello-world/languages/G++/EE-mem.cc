#include <iostream>
using namespace std;

int main() {    
    for (int i = 0; ; ++i) {
        int* a = new int[1024*1024];
        cout << i << endl;
    }
}
