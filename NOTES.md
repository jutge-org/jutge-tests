# Scripts

# jutge-exec
Outside:
-   jutge-run <image> [worker-outside][testing]
Inside:
-   jutge-submit [worker-inside]
	-   jutge-start [jutge-submit]
	-   jutge-sanitize [jutge-submit]
-   jutge-somhi [worker-inside]: (nobody, seguretat en temps de compilació)

```sh
curl https://github.com/jutge-org/... # Descarregar el tar
scp jutge-exec.tar.gz worker1:.
ssh worker1 make install-outside
# ssh worker1 make install-inside
```

# jutge-toolkit
-   jutge-install-sudo-tools [profes]
-   jutge-available-compilers [web]: Llistar compiladors (de dues maneres!)
-   jutge-compilers [web-inside]: informació de les versions exactes de les màquines.
-   jutge-make-problem [profes]: Compilar un problema (inclou LaTeX).
-   jutge-make-quiz    [web][profes]: Aleatoritzar el quiz
-   jutge-code-metrics [web][profes]

`pip install jutge-toolkit`


# Casos d'ús

Un profe vol crear un problema per PRO2. 
1. Instalar-se el `jutge-toolkit`.
2. Crear el problema.
3. `jutge-make-problem` -> Discrepàncies amb l'execució al Jutge.
4. `jutge-install-sudo-tools` -> ara té el vinga.
5. Pot fer servir el `jutge-vinga` directament.

# Web

- Compilar LaTeX (imatge `latex`).


# Salvador

```sh
ssh worker1 /home/worker/bin/jutge-run jutge-submit taskid < task.tar > correction.tgz
```