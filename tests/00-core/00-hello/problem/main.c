#include <stdio.h>

int max4(int a, int b, int c, int d);

int main() {
	int a, b, c, d;
	while (scanf("%d %d %d %d", &a, &b, &c, &d) > 0) {
    printf("%d\n", max4(a, b, c, d));
	}
	return 0;
}
