#include <iostream>
using namespace std;

int main() {
    int x, y;
    cin >> x >> y;
    cout.setf(ios::fixed);
    cout.precision(1);
    double d = average(x, y);
    cout << d << endl;
}