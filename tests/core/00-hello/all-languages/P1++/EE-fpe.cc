#include <iostream>
using namespace std;

int f() {
    return 1;
}

int main() {
    cout << 1/(f() - f());
}
