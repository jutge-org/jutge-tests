#include <iostream>
using namespace std;

/*

FIXME(pauek)
- This doesn't generate a SIGFPE anymore.
- See this: https://en.cppreference.com/w/cpp/numeric/fenv

*/

int f() {
    return 1;
}

int main() {
    cout << 1/(f() - f());
}
