import '@azure/core-asynciterator-polyfill';
import React, { useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  Text,
  View,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  useQuery,
  PowerSyncContext,
  usePowerSync,
} from '@powersync/react-native';
import { system, SystemContext, useOpSqlite } from './SystemContext.tsx';
import { PlusIcon, XIcon } from 'lucide-react-native';

type Customer = {
  id: string;
  name: string;
};

function App(): React.JSX.Element {
  useEffect(() => {
    const initialize = async () => {
      try {
        await system.init();
        console.log('System initialized successfully');
      } catch (error) {
        console.error('Error initializing system:', error);
      }
    };
    initialize();
  }, []);

  return (
    <SystemContext.Provider value={system}>
      <PowerSyncContext.Provider value={system.powersync}>
        <SafeAreaView>
          <Image source={require('../logo.png')} style={styles.logo} />
          <View style={styles.mainContainer}>
            <View>
              <Text style={styles.sectionTitle}>Async List</Text>
              <AsyncCustomerList />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Sync List</Text>
              <SyncCustomerList />
            </View>
          </View>
        </SafeAreaView>
      </PowerSyncContext.Provider>
    </SystemContext.Provider>
  );
}

function AsyncCustomerList() {
  /**
   * You can still use the PowerSync watch queries even if you're using OPSqlite to write data.
   */
  const {
    data: customers,
    isLoading,
    error,
  } = useQuery<Customer>('SELECT * FROM customers');
  const powerSync = usePowerSync();

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  if (error) {
    return <Text>Error: {error.message}</Text>;
  }

  return (
    <View>
      <TouchableOpacity
        onPress={async () => {
          const id = Math.floor(Math.random() * 1000).toString();
          await powerSync.execute(
            'INSERT INTO customers(id, name) VALUES(?, ?)',
            [id, `Customer ${id}`],
          );
        }}
        style={styles.addButton}
      >
        <PlusIcon stroke={'#0894ff'} />
        <Text style={styles.addButtonText}>Customer</Text>
      </TouchableOpacity>
      <FlatList
        data={customers}
        renderItem={({ item: customer }) => (
          <TouchableOpacity
            key={customer.id}
            onPress={async () => {
              await powerSync.execute('DELETE FROM customers WHERE id = ?', [
                customer.id,
              ]);
            }}
            style={styles.customerItem}
          >
            <Text key={customer.id} style={styles.customerName}>
              {customer.name}
            </Text>
            <XIcon stroke={'grey'} size={18} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function SyncCustomerList() {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const opSqlite = useOpSqlite();

  const getCustomers = useCallback(() => {
    if (!opSqlite) return;

    try {
      const result = opSqlite.executeSync('SELECT * FROM customers');
      setCustomers(
        result.rows.map(row => ({
          id: row.id as string,
          name: row.name as string,
        })),
      );
    } catch (error) {
      console.error('Error fetching customers:', error);
      return;
    }
  }, [opSqlite]);

  // Process transactions from ps_crud
  const flushCrudTransactions = async () => {
    await system.connector.uploadData(system.powersync);
  };

  // Get initial customers when the component mounts
  useEffect(() => {
    getCustomers();
  }, [opSqlite, getCustomers]);

  // Listens for changes from PowerSync updates
  useEffect(() => {
    const disposeChange = system.powersync.onChangeWithCallback(
      {
        onChange: () => {
          getCustomers();
        },
      },
      {
        tables: ['customers'],
      },
    );

    return () => {
      disposeChange();
    };
  }, [getCustomers]);

  return (
    <View>
      <TouchableOpacity
        onPress={() => {
          const id = Math.floor(Math.random() * 1000);
          opSqlite.executeSync(
            'INSERT INTO ps_crud (id, data, tx_id) VALUES(?, ?, ?)',
            [
              id,
              JSON.stringify({
                op: 'PUT',
                type: 'customers',
                id,
                data: {
                  name: `Customer ${id}`,
                },
              }),
            ],
          );
          flushCrudTransactions();
          getCustomers();
        }}
        style={styles.addButton}
      >
        <PlusIcon stroke={'#0894ff'} />
        <Text style={styles.addButtonText}>Customer</Text>
      </TouchableOpacity>
      <FlatList
        data={customers}
        renderItem={({ item: customer }) => (
          <TouchableOpacity
            key={customer.id}
            onPress={() => {
              const id = Math.floor(Math.random() * 1000);
              // Add to the upload queue (ps_crud) for deletion
              opSqlite.executeSync(
                'INSERT INTO ps_crud (id, data, tx_id) VALUES(?, ?, ?)',
                [
                  id,
                  JSON.stringify({
                    op: 'DELETE',
                    type: 'customers',
                    id: customer.id,
                  }),
                  id,
                ],
              );
              flushCrudTransactions();
              getCustomers();
            }}
            style={styles.customerItem}
          >
            <Text key={customer.id} style={styles.customerName}>
              {customer.name}
            </Text>
            <XIcon stroke={'grey'} size={18} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    marginVertical: 20,
    objectFit: 'contain',
    height: 50,
    width: '100%',
  },
  mainContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 10,
    textAlign: 'center',
  },
  addButton: {
    marginVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 16,
    color: '#0894ff',
  },
  customerItem: {
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    padding: 10,
    marginVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  customerName: {
    fontSize: 16,
  },
});

export default App;
