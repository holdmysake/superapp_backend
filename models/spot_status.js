import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import Spot from './spot.model.js'
import moment from 'moment-timezone'

const SpotStatus = sequelize.define('spot_status', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    spot_id: {
        type: DataTypes.STRING(10),
        allowNull: false,
        references: {
            model: Spot,
            key: 'spot_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    type: {
        type: DataTypes.ENUM('pump', 'device'),
        defaultValue: 'pump',
        allowNull: false
    },    
    status: {
        type: DataTypes.ENUM('on', 'off'),
        defaultValue: 'off',
        allowNull: false
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        get() {
            const raw = this.getDataValue('timestamp')
            return raw ? moment(raw).format('YYYY-MM-DD HH:mm:ss') : null
        }
    }
}, {
    tableName: 'spot_status',
    timestamps: false,
    underscored: true
})

export default SpotStatus
